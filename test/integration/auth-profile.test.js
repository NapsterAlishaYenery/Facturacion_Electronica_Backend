require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    let testRnc = '130999222';
    let testEmail = 'profile-test@expedinap.com';
    let createdCompanyId = null;
    let accessCookie = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: testEmail } });

        // Setup: registrar empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Profile Test Company' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Original',
                    middleName: 'Middle',
                    lastName: 'LastName',
                    secondLastName: 'SecondLast'
                }
            })
        });

        createdCompanyId = registerRes.body?.data?.company?.id;

        // Login para obtener cookie
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

        // ============================================================
        // Test 1: PATCH /me actualiza nombre
        // ============================================================
        console.log('--- Test 1: PATCH /me ---');
        const updateRes = await request('/api/auth/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                firstName: 'Updated',
                lastName: 'NewLast'
            })
        });

        await test('status 200', updateRes.status === 200, `got ${updateRes.status}`);
        await test('firstName updated', updateRes.body?.data?.user?.firstName === 'Updated');
        await test('lastName updated', updateRes.body?.data?.user?.lastName === 'NewLast');
        await test('middleName unchanged', updateRes.body?.data?.user?.middleName === 'Middle');

        // Test 2: Intento de actualizar campo prohibido
        console.log('\n--- Test 2: Campo prohibido se elimina ---');
        const badUpdateRes = await request('/api/auth/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                firstName: 'Updated2',
                email: 'hacker@test.com',  // ← No permitido
                role: 'admin'              // ← No permitido
            })
        });

        await test('status 200', badUpdateRes.status === 200);
        await test('firstName updated again', badUpdateRes.body?.data?.user?.firstName === 'Updated2');
        await test('email NOT changed', badUpdateRes.body?.data?.user?.email === testEmail);

        // Test 3: PATCH /me sin campos
        console.log('\n--- Test 3: PATCH /me vacío ---');
        const emptyRes = await request('/api/auth/me', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({})
        });
        await test('status 400', emptyRes.status === 400, `got ${emptyRes.status}`);

        // Test 4: Cambiar contraseña exitosamente
        console.log('\n--- Test 4: PATCH /change-password ---');
        const passRes = await request('/api/auth/change-password', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                currentPassword: 'SecurePass123',
                newPassword: 'NewSecurePass456'
            })
        });
        await test('status 200', passRes.status === 200, `got ${passRes.status}`);
        await test('success true', passRes.body?.success === true);

        // Test 5: Login con contraseña vieja (debe fallar)
        console.log('\n--- Test 5: Login con password vieja ---');
        const oldLoginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });
        await test('status 401', oldLoginRes.status === 401, `got ${oldLoginRes.status}`);

        // Test 6: Login con contraseña nueva (debe pasar)
        console.log('\n--- Test 6: Login con password nueva ---');
        const newLoginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'NewSecurePass456' })
        });
        await test('status 200', newLoginRes.status === 200, `got ${newLoginRes.status}`);

        // Test 7: Cambio de contraseña con currentPassword incorrecta
        console.log('\n--- Test 7: change-password con currentPassword incorrecta ---');
        const badPassRes = await request('/api/auth/change-password', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                currentPassword: 'WrongPass999',
                newPassword: 'AnotherPass789'
            })
        });
        await test('status 401', badPassRes.status === 401, `got ${badPassRes.status}`);
        await test('code INVALID_CURRENT_PASSWORD', badPassRes.body?.error?.code === 'INVALID_CURRENT_PASSWORD');

        // Test 8: Nueva contraseña no cumple reglas
        console.log('\n--- Test 8: Nueva password débil ---');
        const weakPassRes = await request('/api/auth/change-password', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                currentPassword: 'NewSecurePass456',
                newPassword: 'weak'
            })
        });
        await test('status 400', weakPassRes.status === 400, `got ${weakPassRes.status}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
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