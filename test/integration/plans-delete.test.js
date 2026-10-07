require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { Plan, Company, Subscription, User, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

async function loginAsAdmin() {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.TEST_ADMIN_EMAIL,
            password: process.env.TEST_ADMIN_PASSWORD
        })
    });
    if (res.status !== 200) {
        throw new Error(`Admin login failed (${res.status})`);
    }
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
    return accessCookieFull?.split(';')[0];
}

(async () => {
    const codeFree = 'test_7_5_free';        // plan sin suscripciones
    const codeInUse = 'test_7_5_in_use';     // plan con suscripción activa
    const testRnc = '130999555';
    let adminCookie = null;
    let freePlanId = null;
    let inUsePlanId = null;
    let companyId = null;

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
        await Plan.destroy({ where: { code: codeFree } });
        await Plan.destroy({ where: { code: codeInUse } });

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // Setup: plan sin suscripciones
        const freePlan = await Plan.create({
            code: codeFree,
            name: 'Plan Libre',
            priceDop: 500,
            invoicesPerMonth: 50,
            maxUsers: 1,
            maxSequences: 1
        });
        freePlanId = freePlan.id;

        // Setup: plan con suscripción activa
        const inUsePlan = await Plan.create({
            code: codeInUse,
            name: 'Plan En Uso',
            priceDop: 800,
            invoicesPerMonth: 80,
            maxUsers: 2,
            maxSequences: 1
        });
        inUsePlanId = inUsePlan.id;

        const company = await Company.create({
            rnc: testRnc,
            name: 'Company Test 7.5'
        });
        companyId = company.id;

        await Subscription.create({
            companyId,
            planId: inUsePlanId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        console.log('✅ Setup completed\n');

        // ============================================================
        // Test 1: Soft delete de plan sin suscripciones
        // ============================================================
        console.log('--- Test 1: Soft delete plan libre ---');
        const res1 = await request(`/api/plans/${freePlanId}`, {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('isActive false', res1.body?.data?.plan?.isActive === false);

        // Verificar que ya no aparece en el listado público
        const listRes = await request('/api/plans');
        const stillListed = listRes.body?.data?.items?.some(p => p.id === freePlanId);
        await test('plan no longer in public list', !stillListed);

        // ============================================================
        // Test 2: Plan no aparece en GET /:id → 404
        // ============================================================
        console.log('\n--- Test 2: Plan inactivo → 404 ---');
        const res2 = await request(`/api/plans/${freePlanId}`);
        await test('status 404', res2.status === 404, `got ${res2.status}`);
        await test('code PLAN_NOT_FOUND', res2.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 3: Idempotencia — borrar de nuevo devuelve 200
        // ============================================================
        console.log('\n--- Test 3: Idempotencia ---');
        const res3 = await request(`/api/plans/${freePlanId}`, {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });
        await test('status 200', res3.status === 200, `got ${res3.status}`);
        await test('still isActive false', res3.body?.data?.plan?.isActive === false);

        // ============================================================
        // Test 4: Plan en uso → 409
        // ============================================================
        console.log('\n--- Test 4: Plan en uso → 409 ---');
        const res4 = await request(`/api/plans/${inUsePlanId}`, {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });
        await test('status 409', res4.status === 409, `got ${res4.status}`);
        await test('code PLAN_IN_USE', res4.body?.error?.code === 'PLAN_IN_USE');

        // ============================================================
        // Test 5: Plan inexistente → 404
        // ============================================================
        console.log('\n--- Test 5: Plan inexistente ---');
        const res5 = await request('/api/plans/00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });
        await test('status 404', res5.status === 404, `got ${res5.status}`);
        await test('code PLAN_NOT_FOUND', res5.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 6: UUID inválido → 400
        // ============================================================
        console.log('\n--- Test 6: UUID inválido ---');
        const res6 = await request('/api/plans/not-a-uuid', {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });
        await test('status 400', res6.status === 400, `got ${res6.status}`);
        await test('code INVALID_ID_FORMAT',
            res6.body?.error?.code === 'INVALID_ID_FORMAT');

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request(`/api/plans/${inUsePlanId}`, {
            method: 'DELETE'
        });
        await test('status 401', res7.status === 401, `got ${res7.status}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (companyId) {
                await AuditLog.destroy({ where: { companyId } });
                await Subscription.destroy({ where: { companyId } });
                await User.destroy({ where: { companyId } });
                await Company.destroy({ where: { id: companyId } });
            }
            if (freePlanId) await Plan.destroy({ where: { id: freePlanId } });
            if (inUsePlanId) await Plan.destroy({ where: { id: inUsePlanId } });
            await Plan.destroy({ where: { code: codeFree } });
            await Plan.destroy({ where: { code: codeInUse } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();