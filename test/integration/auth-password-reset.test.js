require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, AuditLog, PasswordReset } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    let testRnc = '130999333';
    let testEmail = 'reset-test@expedinap.com';
    let createdCompanyId = null;
    let resetCode = null;
    let accessCookie = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await PasswordReset.destroy({ where: { userId: (await User.findOne({ where: { companyId: oldCompany.id } }))?.id } });
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: testEmail } });

        // Setup
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Reset Test Company' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Reset',
                    lastName: 'Tester'
                }
            })
        });
        createdCompanyId = registerRes.body?.data?.company?.id;

        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });

        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
        accessCookie = accessCookieFull?.split(';')[0];

        console.log('✅ Setup completed\n');

        // Test 1: forgot-password
        console.log('--- Test 1: forgot-password ---');
        const forgotRes = await request('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail })
        });
        await test('status 200', forgotRes.status === 200, `got ${forgotRes.status}`);
        await test('success true', forgotRes.body?.success === true);

        // Leer el código generado directamente de la BD
        const user = await User.findByEmail(testEmail);
        const reset = await PasswordReset.findOne({
            where: { userId: user.id, usedAt: null },
            order: [['createdAt', 'DESC']]
        });
        resetCode = reset?.code;
        await test('reset code exists in DB', !!resetCode, resetCode ? `code: ${resetCode}` : '');

        // Test 2: reset-password con código inválido
        console.log('\n--- Test 2: reset con código inválido ---');
        const badResetRes = await request('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                code: '000000',
                newPassword: 'NewSecurePass456'
            })
        });
        await test('status 400', badResetRes.status === 400, `got ${badResetRes.status}`);
        await test('code INVALID_RESET_CODE', badResetRes.body?.error?.code === 'INVALID_RESET_CODE');

        // Test 3: reset-password exitoso
        console.log('\n--- Test 3: reset-password exitoso ---');
        const resetRes = await request('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                code: resetCode,
                newPassword: 'NewSecurePass456'
            })
        });
        await test('status 200', resetRes.status === 200, `got ${resetRes.status}`);
        await test('success true', resetRes.body?.success === true);

        // Test 4: login con contraseña vieja (debe fallar)
        console.log('\n--- Test 4: login con password vieja ---');
        const oldLoginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });
        await test('status 401', oldLoginRes.status === 401, `got ${oldLoginRes.status}`);

        // Test 5: login con contraseña nueva
        console.log('\n--- Test 5: login con password nueva ---');
        const newLoginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'NewSecurePass456' })
        });
        await test('status 200', newLoginRes.status === 200, `got ${newLoginRes.status}`);

        // Test 6: reutilizar el mismo código (debe fallar)
        console.log('\n--- Test 6: reusar código ---');
        const reuseRes = await request('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                code: resetCode,
                newPassword: 'AnotherPass789'
            })
        });
        await test('status 400', reuseRes.status === 400, `got ${reuseRes.status}`);

        // Test 7: refresh token
        console.log('\n--- Test 7: refresh token ---');
        // Obtener refresh token de la cookie
        const refreshCookieFull = cookies.find(c => c?.startsWith('refresh_token='));
        const refreshCookie = refreshCookieFull?.split(';')[0];

        const refreshRes = await request('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Cookie': refreshCookie }
        });
        await test('status 200', refreshRes.status === 200, `got ${refreshRes.status}`);
        await test('success true', refreshRes.body?.success === true);

        // Test 8: refresh sin cookie (debe fallar)
        console.log('\n--- Test 8: refresh sin cookie ---');
        const noRefreshRes = await request('/api/auth/refresh', {
            method: 'POST'
        });
        await test('status 401', noRefreshRes.status === 401, `got ${noRefreshRes.status}`);

        // Test 9: forgot-password con email inexistente (debe devolver 200 por seguridad)
        console.log('\n--- Test 9: forgot-password email inexistente ---');
        const noUserRes = await request('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'no-existe@test.com' })
        });
        await test('status 200', noUserRes.status === 200, `got ${noUserRes.status}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (createdCompanyId) {
                const user = await User.findOne({ where: { companyId: createdCompanyId } });
                if (user) {
                    await PasswordReset.destroy({ where: { userId: user.id } });
                }
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