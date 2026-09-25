require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog, PasswordReset } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc = '130999903';
let testEmail = 'owner-delete@expedinap.com';
let adminEmail = 'admin-delete@expedinap.com';
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
            lastName: 'Delete',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Delete Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Delete'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');

        // Verificar setup: la empresa existe con usuarios y suscripción
        const userCountBefore = await User.count({ where: { companyId: testCompanyId } });
        const subCountBefore = await Subscription.count({ where: { companyId: testCompanyId } });
        const auditCountBefore = await AuditLog.count({ where: { companyId: testCompanyId } });

        console.log('✅ Setup completed');
        console.log(`   Users: ${userCountBefore}, Subscriptions: ${subCountBefore}, AuditLogs: ${auditCountBefore}\n`);

        // ============================================================
        // TEST 1: company_admin NO puede borrar
        // ============================================================
        console.log('--- Test 1: company_admin intenta borrar ---');
        const forbiddenRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 2: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 2: sin autenticación ---');
        const noAuthRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'DELETE'
        });
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // TEST 3: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 3: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/companies/00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            headers: { Cookie: adminCookie }
        });
        test('status 404', notFoundRes.status === 404, `got ${notFoundRes.status}`);
        test('code COMPANY_NOT_FOUND', notFoundRes.body?.error?.code === 'COMPANY_NOT_FOUND');

        // ============================================================
        // TEST 4: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 4: ID malformado → 400 ---');
        const badIdRes = await request('/api/companies/not-a-uuid', {
            method: 'DELETE',
            headers: { Cookie: adminCookie }
        });
        test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);

        // ============================================================
        // TEST 5: admin borra exitosamente
        // ============================================================
        console.log('\n--- Test 5: admin borra empresa ---');
        const deleteRes = await request(`/api/companies/${testCompanyId}`, {
            method: 'DELETE',
            headers: { Cookie: adminCookie }
        });
        test('status 200', deleteRes.status === 200, `got ${deleteRes.status}`);
        test('deleted is true', deleteRes.body?.data?.deleted === true);
        test('has before data', deleteRes.body?.data?.before?.rnc === testRnc);

        // ============================================================
        // TEST 6: verificar cascada en BD
        // ============================================================
        console.log('\n--- Test 6: verificar cascada ---');
        const companyAfter = await Company.findByPk(testCompanyId);
        test('company no longer exists', companyAfter === null);

        const usersAfter = await User.count({ where: { companyId: testCompanyId } });
        test('users deleted', usersAfter === 0);

        const subsAfter = await Subscription.count({ where: { companyId: testCompanyId } });
        test('subscriptions deleted', subsAfter === 0);

        const seqAfter = await Sequence.count({ where: { companyId: testCompanyId } });
        test('sequences deleted', seqAfter === 0);

        // ============================================================
        // TEST 7: audit logs NO se borraron (company_id → NULL)
        // ============================================================
        console.log('\n--- Test 7: audit logs conservados ---');
        const auditLogsAfter = await AuditLog.findAll({
            where: {
                companyId: null,
                action: 'company.deleted'
            }
        });
        test('has company.deleted log with NULL company_id', auditLogsAfter.length >= 1, `count: ${auditLogsAfter.length}`);

        // ============================================================
        // TEST 8: audit log conserva before data
        // ============================================================
        console.log('\n--- Test 8: audit log conserva datos ---');
        const deleteLog = auditLogsAfter[0];
        test('has before.rnc', deleteLog?.before?.rnc === testRnc);
        test('has before.name', deleteLog?.before?.name === 'Delete Test SRL');
        test('has stats', !!deleteLog?.after?.stats);

        // Limpiar el audit log huérfano (ya no tiene company_id)
        await AuditLog.destroy({ where: { action: 'company.deleted', companyId: null, entity_id: testCompanyId } });

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            // Limpieza residual
            if (testCompanyId) {
                await AuditLog.destroy({ where: { entity_id: testCompanyId } });
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