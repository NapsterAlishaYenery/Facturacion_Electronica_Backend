require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testCompanyId = null;
let testRnc = '130999666';
let testEmail = 'companies-me-test@expedinap.com';
let adminEmail = 'admin-companies-me@expedinap.com';
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
        await User.destroy({ where: { email: testEmail } });
        await User.destroy({ where: { email: adminEmail } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'CompaniesMe',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Companies ME Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Me'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Login de ambos
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin obtiene SU empresa
        // ============================================================
        console.log('--- Test 1: company_admin GET /me ---');
        const meRes = await request('/api/companies/me', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', meRes.status === 200, `got ${meRes.status}`);
        test('has company', !!meRes.body?.data?.company);
        test('company.id matches', meRes.body?.data?.company?.id === testCompanyId);
        test('company.rnc matches', meRes.body?.data?.company?.rnc === testRnc);
        test('has subscription', !!meRes.body?.data?.subscription);
        test('subscription status is trial', meRes.body?.data?.subscription?.status === 'trial');
        test('has plan', !!meRes.body?.data?.plan);
        test('plan code is basic', meRes.body?.data?.plan?.code === 'basic');
        test('has stats', !!meRes.body?.data?.stats);
        test('stats.usersCount is 1', meRes.body?.data?.stats?.usersCount === 1);
        test('stats.sequencesCount is 0', meRes.body?.data?.stats?.sequencesCount === 0);

        // ============================================================
        // TEST 2: admin recibe error (no tiene empresa)
        // ============================================================
        console.log('\n--- Test 2: admin GET /me (debe fallar) ---');
        const adminMeRes = await request('/api/companies/me', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminMeRes.status === 400, `got ${adminMeRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminMeRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 3: sin autenticación (debe fallar)
        // ============================================================
        console.log('\n--- Test 3: sin autenticación ---');
        const noAuthRes = await request('/api/companies/me');
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);
        test('code NO_TOKEN', noAuthRes.body?.error?.code === 'NO_TOKEN');

        // ============================================================
        // TEST 4: verificar que stats reflejan el conteo real
        // ============================================================
        console.log('\n--- Test 4: stats reflejan conteo real ---');
        // Agregar un operador
        await User.create({
            email: 'operator-companies-me@expedinap.com',
            password: 'OperatorPass123',
            firstName: 'Operator',
            lastName: 'Me',
            role: 'operator',
            companyId: testCompanyId
        });

        const meRes2 = await request('/api/companies/me', {
            headers: { Cookie: companyAdminCookie }
        });
        test('usersCount is now 2', meRes2.body?.data?.stats?.usersCount === 2);

        // Limpiar el operador
        await User.destroy({ where: { email: 'operator-companies-me@expedinap.com' } });

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
            await User.destroy({ where: { email: testEmail } });
            await User.destroy({ where: { email: adminEmail } });
            await User.destroy({ where: { email: 'operator-companies-me@expedinap.com' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();