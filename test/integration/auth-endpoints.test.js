require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    let testRnc = '130999111';
    let testEmail = 'auth-test-owner@expedinap.com';
    let createdCompanyId = null;
    let createdUserId = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpiar residuos
        await Company.destroy({ where: { rnc: testRnc } });
        await User.destroy({ where: { email: testEmail } });

        console.log('--- Test 1: Registro de empresa ---');
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: {
                    rnc: testRnc,
                    name: 'Auth Test Company SRL',
                    email: 'company@test.com',
                    phone: '+18095551234'
                },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Juan',
                    lastName: 'Pérez'
                }
            })
        });

        await test('status 201', registerRes.status === 201, `got ${registerRes.status}`);
        await test('success true', registerRes.body?.success === true);
        await test('has user', !!registerRes.body?.data?.user);
        await test('has company', !!registerRes.body?.data?.company);
        await test('has subscription (trial)', !!registerRes.body?.data?.subscription);
        await test('no passwordHash exposed', !registerRes.body?.data?.user?.passwordHash);

        createdCompanyId = registerRes.body?.data?.company?.id;
        createdUserId = registerRes.body?.data?.user?.id;

        console.log('\n--- Test 2: Login exitoso ---');
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'SecurePass123'
            })
        });

        await test('status 200', loginRes.status === 200, `got ${loginRes.status}`);
        await test('success true', loginRes.body?.success === true);
        await test('has user', !!loginRes.body?.data?.user);

        // Capturar la cookie del login
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const accessCookie = cookies.find(c => c?.startsWith('access_token='));

        console.log('\n--- Test 3: Login con password incorrecta ---');
        const badLoginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'WrongPass123'
            })
        });
        await test('status 401', badLoginRes.status === 401, `got ${badLoginRes.status}`);
        await test('code INVALID_CREDENTIALS', badLoginRes.body?.error?.code === 'INVALID_CREDENTIALS');

        console.log('\n--- Test 4: GET /me con cookie ---');
        const meRes = await request('/api/auth/me', {
            headers: accessCookie ? { Cookie: accessCookie.split(';')[0] } : {}
        });
        await test('status 200', meRes.status === 200, `got ${meRes.status}`);
        await test('has user', !!meRes.body?.data?.user);
        await test('has company included', !!meRes.body?.data?.user?.company);

        console.log('\n--- Test 5: GET /me sin cookie (debe fallar) ---');
        const meNoAuthRes = await request('/api/auth/me');
        await test('status 401', meNoAuthRes.status === 401, `got ${meNoAuthRes.status}`);
        await test('code NO_TOKEN', meNoAuthRes.body?.error?.code === 'NO_TOKEN');

        console.log('\n--- Test 6: Logout ---');
        const logoutRes = await request('/api/auth/logout', {
            method: 'POST',
            headers: accessCookie ? { Cookie: accessCookie.split(';')[0] } : {}
        });
        await test('status 200', logoutRes.status === 200, `got ${logoutRes.status}`);
        await test('success true', logoutRes.body?.success === true);

        console.log('\n--- Test 7: RNC duplicado ---');
        const dupRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: {
                    rnc: testRnc,
                    name: 'Duplicate Company'
                },
                owner: {
                    email: 'other@test.com',
                    password: 'SecurePass123',
                    firstName: 'Other',
                    lastName: 'Owner'
                }
            })
        });
        await test('status 409', dupRes.status === 409, `got ${dupRes.status}`);
        await test('code RNC_ALREADY_EXISTS', dupRes.body?.error?.code === 'RNC_ALREADY_EXISTS');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        // Limpieza
        try {
            if (createdCompanyId) {
                await AuditLog.destroy({ where: { companyId: createdCompanyId } });
                await Subscription.destroy({ where: { companyId: createdCompanyId } });
                await User.destroy({ where: { companyId: createdCompanyId } });
                await Company.destroy({ where: { id: createdCompanyId } });
            }
            await Company.destroy({ where: { rnc: testRnc } });
            await User.destroy({ where: { email: testEmail } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();