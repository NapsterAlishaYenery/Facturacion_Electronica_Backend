require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let operatorCookie = null;
let adminCookie = null;
let testCompanyId = null;
let testRnc = '130999777';
let testEmail = 'companies-update-test@expedinap.com';
let operatorEmail = 'operator-update-test@expedinap.com';
let adminEmail = 'admin-companies-update@expedinap.com';
let adminId = null;

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
}

async function loginAndGetCookie(email, password) {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookie = cookies.find(c => c?.startsWith('access_token='));
    return accessCookie?.split(';')[0];
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: [testEmail, operatorEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'CompaniesUpdate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Companies Update Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Update'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Crear un operador para probar role guard
        const operatorRes = await request('/api/auth/company/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': await loginAndGetCookie(testEmail, 'OwnerPass123')
            },
            body: JSON.stringify({
                email: operatorEmail,
                password: 'OperatorPass123',
                firstName: 'Operator',
                lastName: 'Update'
            })
        });

        // Login de los 3 usuarios
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        operatorCookie = await loginAndGetCookie(operatorEmail, 'OperatorPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin actualiza su empresa exitosamente
        // ============================================================
        console.log('--- Test 1: company_admin actualiza ---');
        const updateRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                name: 'Companies Update Test SRL (Renamed)',
                phone: '+18095559999',
                address: 'Av. Principal #123, Santo Domingo'
            })
        });
        test('status 200', updateRes.status === 200, `got ${updateRes.status}`);
        test('name updated', updateRes.body?.data?.company?.name === 'Companies Update Test SRL (Renamed)');
        test('phone updated', updateRes.body?.data?.company?.phone === '+18095559999');
        test('address updated', updateRes.body?.data?.company?.address === 'Av. Principal #123, Santo Domingo');

        // ============================================================
        // TEST 2: intentar actualizar campos prohibidos (deben ignorarse)
        // ============================================================
        console.log('\n--- Test 2: campos prohibidos ignorados ---');
        const badUpdateRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                name: 'New Name Attempt',
                rnc: '130999999',             // ← NO permitido
                dgiiEnvironment: 'production', // ← NO permitido
                isActive: false                // ← NO permitido
            })
        });
        test('status 200', badUpdateRes.status === 200);
        test('name still updated', badUpdateRes.body?.data?.company?.name === 'New Name Attempt');
        test('rnc NOT changed', badUpdateRes.body?.data?.company?.rnc === testRnc);
        test('dgiiEnvironment NOT changed', badUpdateRes.body?.data?.company?.dgiiEnvironment === 'testecf');
        test('isActive NOT changed', badUpdateRes.body?.data?.company?.isActive === true);

        // ============================================================
        // TEST 3: body vacío → error 400
        // ============================================================
        console.log('\n--- Test 3: body vacío ---');
        const emptyRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400, `got ${emptyRes.status}`);
        test('code VALIDATION_ERROR', emptyRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 4: intentar actualizar con email inválido
        // ============================================================
        console.log('\n--- Test 4: email inválido ---');
        const badEmailRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ email: 'no-es-email' })
        });
        test('status 400', badEmailRes.status === 400, `got ${badEmailRes.status}`);
        test('code VALIDATION_ERROR', badEmailRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 5: operador NO puede actualizar (role guard)
        // ============================================================
        console.log('\n--- Test 5: operator intenta actualizar ---');
        const operatorRes2 = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': operatorCookie
            },
            body: JSON.stringify({ name: 'Hacked By Operator' })
        });
        test('status 403', operatorRes2.status === 403, `got ${operatorRes2.status}`);
        test('code INSUFFICIENT_ROLE', operatorRes2.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 6: admin NO puede usar /me (no tiene empresa)
        // ============================================================
        console.log('\n--- Test 6: admin intenta /me ---');
        const adminRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ name: 'Admin Hacked' })
        });
        // El admin PUEDE pasar el roleMiddleware (admin >= company_admin)
        // pero el servicio detecta que no tiene empresa y devuelve 400 NO_COMPANY_ASSIGNED
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');


        // ============================================================
        // TEST 7: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 7: sin autenticación ---');
        const noAuthRes = await request('/api/companies/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'No Auth' })
        });
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // TEST 8: verificar audit log
        // ============================================================
        console.log('\n--- Test 8: audit log creado ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'company.updated',
                entity: 'company'
            }
        });
        test('at least 1 company.updated log', auditCount >= 1, `count: ${auditCount}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (testCompanyId) {
                await AuditLog.destroy({ where: { companyId: testCompanyId } });
                await Subscription.destroy({ where: { companyId: testCompanyId } });
                await Sequence.destroy({ where: { companyId: testCompanyId } });
                await User.destroy({ where: { companyId: testCompanyId } });
                await Company.destroy({ where: { id: testCompanyId } });
            }
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [testEmail, operatorEmail, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();