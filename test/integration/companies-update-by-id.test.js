require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc = '130999901';
let testEmail = 'owner-update-by-id@expedinap.com';
let adminEmail = 'admin-update-by-id@expedinap.com';
let testCompanyId = null;
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
        await User.destroy({ where: { email: [testEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'UpdateById',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Original Name SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'UpdateById'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin actualiza campos básicos
        // ============================================================
        console.log('--- Test 1: admin actualiza campos básicos ---');
        const updateRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                name: 'Updated Name SRL',
                phone: '+18095557777',
                address: 'New Address #100'
            })
        });
        test('status 200', updateRes.status === 200, `got ${updateRes.status}`);
        test('name updated', updateRes.body?.data?.company?.name === 'Updated Name SRL');
        test('phone updated', updateRes.body?.data?.company?.phone === '+18095557777');
        test('address updated', updateRes.body?.data?.company?.address === 'New Address #100');

        // ============================================================
        // TEST 2: admin cambia dgiiEnvironment
        // ============================================================
        console.log('\n--- Test 2: admin cambia dgiiEnvironment ---');
        const envRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ dgiiEnvironment: 'production' })
        });
        test('status 200', envRes.status === 200);
        test('dgiiEnvironment updated', envRes.body?.data?.company?.dgiiEnvironment === 'production');

        // ============================================================
        // TEST 3: admin desactiva empresa
        // ============================================================
        console.log('\n--- Test 3: admin desactiva empresa ---');
        const deactivateRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 200', deactivateRes.status === 200);
        test('isActive is false', deactivateRes.body?.data?.company?.isActive === false);

        // Reactivar
        await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: true, dgiiEnvironment: 'testecf' })
        });

        // ============================================================
        // TEST 4: campos prohibidos se ignoran (rnc, certificatePassword)
        // ============================================================
        console.log('\n--- Test 4: campos prohibidos ignorados ---');
        const badRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                name: 'Attempt',
                rnc: '999999999',
                certificatePassword: 'hacked',
                certificatePath: '/hacked/path'
            })
        });
        test('status 200', badRes.status === 200);
        test('name updated', badRes.body?.data?.company?.name === 'Attempt');
        test('rnc NOT changed', badRes.body?.data?.company?.rnc === testRnc);
        test('certificatePassword undefined', badRes.body?.data?.company?.certificatePassword === undefined);

        // ============================================================
        // TEST 5: body vacío → 400
        // ============================================================
        console.log('\n--- Test 5: body vacío ---');
        const emptyRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400, `got ${emptyRes.status}`);
        test('code VALIDATION_ERROR', emptyRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 6: dgiiEnvironment inválido → 400
        // ============================================================
        console.log('\n--- Test 6: dgiiEnvironment inválido ---');
        const badEnvRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ dgiiEnvironment: 'staging' })
        });
        test('status 400', badEnvRes.status === 400);
        test('code VALIDATION_ERROR', badEnvRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 7: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 7: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/companies/00000000-0000-0000-0000-000000000000', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ name: 'No Existe' })
        });
        test('status 404', notFoundRes.status === 404);
        test('code COMPANY_NOT_FOUND', notFoundRes.body?.error?.code === 'COMPANY_NOT_FOUND');

        // ============================================================
        // TEST 8: company_admin NO puede usar esta ruta
        // ============================================================
        console.log('\n--- Test 8: company_admin intenta PATCH /:id ---');
        const forbiddenRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ name: 'Hacked By Owner' })
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 9: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 9: sin autenticación ---');
        const noAuthRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'No Auth' })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 10: audit log creado con action correcto
        // ============================================================
        console.log('\n--- Test 10: audit log creado ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'company.updated_by_admin',
                entity: 'company'
            }
        });
        test('has company.updated_by_admin logs', auditCount >= 1, `count: ${auditCount}`);

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
            await User.destroy({ where: { email: [testEmail, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();