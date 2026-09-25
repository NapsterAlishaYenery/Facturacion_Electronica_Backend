require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc = '130999900';
let testEmail = 'owner-get-by-id@expedinap.com';
let adminEmail = 'admin-get-by-id@expedinap.com';
let testCompanyId = null;
let testCompanyAdminId = null;
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
            lastName: 'GetById',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: {
                    rnc: testRnc,
                    name: 'Get By Id Test SRL',
                    tradeName: 'GetById Test',
                    email: 'company@getbyid.com',
                    phone: '+18095558888',
                    address: 'Av. Test #789, Santiago',
                    economicActivity: 'Servicios de prueba'
                },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'GetById'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;
        testCompanyAdminId = registerRes.body?.data?.user?.id;

        // Agregar un operador extra para validar usersCount
        await User.create({
            email: 'operator-get-by-id@expedinap.com',
            password: 'OperatorPass123',
            firstName: 'Operator',
            lastName: 'GetById',
            role: 'operator',
            companyId: testCompanyId
        });

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin obtiene empresa por ID exitosamente
        // ============================================================
        console.log('--- Test 1: admin GET /:id exitoso ---');
        const getRes = await request(`/api/companies/${testCompanyId}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', getRes.status === 200, `got ${getRes.status}`);
        test('has company', !!getRes.body?.data?.company);
        test('company.id matches', getRes.body?.data?.company?.id === testCompanyId);
        test('company.rnc matches', getRes.body?.data?.company?.rnc === testRnc);
        test('company.name matches', getRes.body?.data?.company?.name === 'Get By Id Test SRL');
        test('company.tradeName matches', getRes.body?.data?.company?.tradeName === 'GetById Test');
        test('company.email matches', getRes.body?.data?.company?.email === 'company@getbyid.com');
        test('company.phone matches', getRes.body?.data?.company?.phone === '+18095558888');
        test('company.address matches', getRes.body?.data?.company?.address === 'Av. Test #789, Santiago');
        test('company.economicActivity matches', getRes.body?.data?.company?.economicActivity === 'Servicios de prueba');

        // ============================================================
        // TEST 2: incluye suscripción y plan
        // ============================================================
        console.log('\n--- Test 2: incluye suscripción y plan ---');
        test('has subscription', !!getRes.body?.data?.subscription);
        test('subscription status trial', getRes.body?.data?.subscription?.status === 'trial');
        test('has plan', !!getRes.body?.data?.plan);
        test('plan code basic', getRes.body?.data?.plan?.code === 'basic');

        // ============================================================
        // TEST 3: incluye stats
        // ============================================================
        console.log('\n--- Test 3: incluye stats ---');
        test('has stats', !!getRes.body?.data?.stats);
        test('usersCount is 2', getRes.body?.data?.stats?.usersCount === 2, `got ${getRes.body?.data?.stats?.usersCount}`);
        test('sequencesCount is 0', getRes.body?.data?.stats?.sequencesCount === 0);

        // TEST 4: NO expone campos sensibles del certificado
        console.log('\n--- Test 4: NO expone campos sensibles del certificado ---');
        test('certificatePasswordEncrypted undefined',
            getRes.body?.data?.company?.certificatePasswordEncrypted === undefined);
        test('certificateIv undefined',
            getRes.body?.data?.company?.certificateIv === undefined);
        test('certificateAuthTag undefined',
            getRes.body?.data?.company?.certificateAuthTag === undefined);
        test('certificatePath accessible', getRes.body?.data?.company?.certificatePath === null);

        // ============================================================
        // TEST 5: admin con ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 5: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/companies/00000000-0000-0000-0000-000000000000', {
            headers: { Cookie: adminCookie }
        });
        test('status 404', notFoundRes.status === 404, `got ${notFoundRes.status}`);
        test('code COMPANY_NOT_FOUND', notFoundRes.body?.error?.code === 'COMPANY_NOT_FOUND');

        // ============================================================
        // TEST 6: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 6: ID malformado → 400 ---');
        const badIdRes = await request('/api/companies/not-a-uuid', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);
        test('code INVALID_ID_FORMAT', badIdRes.body?.error?.code === 'INVALID_ID_FORMAT');

        // ============================================================
        // TEST 7: company_admin NO puede ver otras empresas
        // ============================================================
        console.log('\n--- Test 7: company_admin intenta GET /:id ---');
        const forbiddenRes = await request(`/api/companies/${testCompanyId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 8: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 8: sin autenticación ---');
        const noAuthRes = await request(`/api/companies/${testCompanyId}`);
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

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
            await User.destroy({ where: { email: 'operator-get-by-id@expedinap.com' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();