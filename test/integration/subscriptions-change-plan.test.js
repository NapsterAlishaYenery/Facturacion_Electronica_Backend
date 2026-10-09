require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, SubscriptionPayment, Plan, Sequence, AuditLog
} = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    const testRnc = '130999999';
    const testEmail = 'change-plan-test@expedinap.com';
    const newPlanCode = 'test_7_8_target';
    let companyId = null;
    let newPlanId = null;
    let subscriptionId = null;
    let accessCookie = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await SubscriptionPayment.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await Plan.destroy({ where: { code: newPlanCode } });

        // Setup: plan destino
        const newPlan = await Plan.create({
            code: newPlanCode,
            name: 'Plan Target 7.8',
            priceDop: 2500.00,
            priceUsd: 42.00,
            invoicesPerMonth: 1000,
            maxUsers: 10,
            maxSequences: 5,
            features: { reports: true },
            isActive: true
        });
        newPlanId = newPlan.id;

        // Setup: registrar empresa (crea trial con plan default)
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Change Plan Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'ChangePlan',
                    lastName: 'Tester'
                }
            })
        });
        companyId = registerRes.body?.data?.company?.id;

        // Login
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
        accessCookie = accessCookieFull?.split(';')[0];

        // Subscription inicial
        const initialSub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        subscriptionId = initialSub.id;
        const initialPlanId = initialSub.planId;

        // Verificar estado inicial (debe ser trial)
        await test('initial status is trial', initialSub.status === 'trial',
            `got ${initialSub.status}`);

        console.log('✅ Setup completed\n');

        // ============================================================
        // Test 1: Cambio de plan exitoso
        // ============================================================
        console.log('--- Test 1: Cambio de plan exitoso ---');
        const res1 = await request('/api/subscriptions/me/change-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({ planId: newPlanId })
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('subscription planId updated',
            res1.body?.data?.subscription?.planId === newPlanId);
        await test('subscription status is active',
            res1.body?.data?.subscription?.status === 'active');
        await test('plan code matches',
            res1.body?.data?.plan?.code === newPlanCode);
        await test('payment created with pending status',
            res1.body?.data?.payment?.status === 'pending');
        await test('payment amount matches plan price',
            Number(res1.body?.data?.payment?.amount) === 2500.00);
        await test('payment currency is DOP',
            res1.body?.data?.payment?.currency === 'DOP');
        await test('payment notes mention plan change',
            res1.body?.data?.payment?.notes?.includes('Plan change'));

        // ============================================================
        // Test 2: Suscripción cambió a 'active'
        // ============================================================
        console.log('\n--- Test 2: Verificación en BD ---');
        const subAfter = await Subscription.findByPk(subscriptionId);
        await test('status now active', subAfter.status === 'active',
            `got ${subAfter.status}`);
        await test('planId persisted', subAfter.planId === newPlanId);
        await test('invoicesUsedThisMonth reset to 0',
            subAfter.invoicesUsedThisMonth === 0);

        // ============================================================
        // Test 3: currentPeriodStart y End forman un período de 30 días
        // ============================================================
        console.log('\n--- Test 3: Período de 30 días ---');
        const periodStart = new Date(subAfter.currentPeriodStart).getTime();
        const periodEnd = new Date(subAfter.currentPeriodEnd).getTime();
        const periodDurationMs = periodEnd - periodStart;
        const expectedDuration = 30 * 24 * 60 * 60 * 1000;

        await test('period duration is exactly 30 days',
            periodDurationMs === expectedDuration,
            `got ${periodDurationMs}ms, expected ${expectedDuration}ms`);

        const now = Date.now();
        await test('currentPeriodStart is recent (±5h tolerance)',
            Math.abs(periodStart - now) < 5 * 60 * 60 * 1000,
            `diff: ${periodStart - now}ms`);

        // ============================================================
        // Test 4: Mismo plan → 400 SAME_PLAN
        // ============================================================
        console.log('\n--- Test 4: Mismo plan ---');
        const res4 = await request('/api/subscriptions/me/change-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({ planId: newPlanId })
        });

        await test('status 400', res4.status === 400, `got ${res4.status}`);
        await test('code SAME_PLAN', res4.body?.error?.code === 'SAME_PLAN');

        // ============================================================
        // Test 5: Plan inexistente → 404
        // ============================================================
        console.log('\n--- Test 5: Plan inexistente ---');
        const res5 = await request('/api/subscriptions/me/change-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({
                planId: '00000000-0000-0000-0000-000000000000'
            })
        });

        await test('status 404', res5.status === 404, `got ${res5.status}`);
        await test('code PLAN_NOT_FOUND',
            res5.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 6: planId inválido → 400
        // ============================================================
        console.log('\n--- Test 6: planId no UUID ---');
        const res6 = await request('/api/subscriptions/me/change-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': accessCookie
            },
            body: JSON.stringify({ planId: 'not-a-uuid' })
        });

        await test('status 400', res6.status === 400, `got ${res6.status}`);
        await test('code VALIDATION_ERROR',
            res6.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request('/api/subscriptions/me/change-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: initialPlanId })
        });

        await test('status 401', res7.status === 401, `got ${res7.status}`);

        // ============================================================
        // Test 8: Verificar que el pago está en la BD como pending
        // ============================================================
        console.log('\n--- Test 8: Pago pendiente en BD ---');
        const paymentInDb = await SubscriptionPayment.findOne({
            where: { subscriptionId, status: 'pending' },
            order: [['createdAt', 'DESC']]
        });

        await test('payment exists in DB', !!paymentInDb);
        await test('payment companyId matches', paymentInDb?.companyId === companyId);
        await test('payment amount matches',
            Number(paymentInDb?.amount) === 2500.00);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (companyId) {
                await AuditLog.destroy({ where: { companyId } });
                await SubscriptionPayment.destroy({ where: { companyId } });
                await Subscription.destroy({ where: { companyId } });
                await Sequence.destroy({ where: { companyId } });
                await User.destroy({ where: { companyId } });
                await Company.destroy({ where: { id: companyId } });
            }
            if (newPlanId) await Plan.destroy({ where: { id: newPlanId } });
            await Plan.destroy({ where: { code: newPlanCode } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();