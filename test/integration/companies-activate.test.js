require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc = '130999902';
let testEmail = 'owner-activate@expedinap.com';
let adminEmail = 'admin-activate@expedinap.com';
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
            lastName: 'Activate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Activate Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Activate'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: desactivar empresa
        // ============================================================
        console.log('--- Test 1: desactivar empresa ---');
        const deactivateRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 200', deactivateRes.status === 200, `got ${deactivateRes.status}`);
        test('isActive is false', deactivateRes.body?.data?.company?.isActive === false);
        test('message says deactivated', deactivateRes.body?.message?.includes('deactivated'));

        // ============================================================
        // TEST 2: verificar persistencia en BD
        // ============================================================
        console.log('\n--- Test 2: persistencia en BD ---');
        const companyInDb = await Company.findByPk(testCompanyId);
        test('isActive false in DB', companyInDb?.isActive === false);

        // ============================================================
        // TEST 3: reactivar empresa
        // ============================================================
        console.log('\n--- Test 3: reactivar empresa ---');
        const activateRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 200', activateRes.status === 200);
        test('isActive is true', activateRes.body?.data?.company?.isActive === true);
        test('message says activated', activateRes.body?.message?.includes('activated'));

        // ============================================================
        // TEST 4: idempotencia (activar ya activa no falla)
        // ============================================================
        console.log('\n--- Test 4: idempotencia ---');
        const idempotentRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 200', idempotentRes.status === 200);
        test('isActive still true', idempotentRes.body?.data?.company?.isActive === true);

        // ============================================================
        // TEST 5: audit log creado (deactivated + activated)
        // ============================================================
        console.log('\n--- Test 5: audit logs ---');
        const deactivatedCount = await AuditLog.count({
            where: { companyId: testCompanyId, action: 'company.deactivated' }
        });
        const activatedCount = await AuditLog.count({
            where: { companyId: testCompanyId, action: 'company.activated' }
        });
        test('has company.deactivated log', deactivatedCount >= 1, `count: ${deactivatedCount}`);
        test('has company.activated log', activatedCount >= 1, `count: ${activatedCount}`);

        // ============================================================
        // TEST 6: isActive inválido → 400
        // ============================================================
        console.log('\n--- Test 6: isActive inválido ---');
        const invalidRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: 'not-a-boolean' })
        });
        test('status 400', invalidRes.status === 400, `got ${invalidRes.status}`);
        test('code VALIDATION_ERROR', invalidRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 7: body sin isActive → 400
        // ============================================================
        console.log('\n--- Test 7: body sin isActive ---');
        const emptyRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400);

        // ============================================================
        // TEST 8: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 8: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/companies/00000000-0000-0000-0000-000000000000/activate', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 404', notFoundRes.status === 404);
        test('code COMPANY_NOT_FOUND', notFoundRes.body?.error?.code === 'COMPANY_NOT_FOUND');

        // ============================================================
        // TEST 9: company_admin NO puede usar esta ruta
        // ============================================================
        console.log('\n--- Test 9: company_admin intenta activar/desactivar ---');
        const forbiddenRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 10: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 10: sin autenticación ---');
        const noAuthRes = await request(`/api/companies/${testCompanyId}/activate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 11: certificatePassword NO expuesto
        // ============================================================
        console.log('\n--- Test 11: certificatePassword NO expuesto ---');
        test('certificatePassword undefined', deactivateRes.body?.data?.company?.certificatePassword === undefined);
        test('certificatePassword undefined (activate)', activateRes.body?.data?.company?.certificatePassword === undefined);

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