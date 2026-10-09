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

async function loginAsAdmin() {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.TEST_ADMIN_EMAIL,
            password: process.env.TEST_ADMIN_PASSWORD
        })
    });
    if (res.status !== 200) throw new Error(`Admin login failed (${res.status})`);
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    return cookies.find(c => c?.startsWith('access_token='))?.split(';')[0];
}

(async () => {
    const testRnc = '130999501';
    const testEmail = 'register-payment-test@expedinap.com';
    let adminCookie = null;
    let companyId = null;
    let subscriptionId = null;

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

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // Setup: registrar empresa
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Register Payment Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Payment',
                    lastName: 'Tester'
                }
            })
        });
        companyId = registerRes.body?.data?.company?.id;

        const sub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        subscriptionId = sub.id;

        console.log('✅ Setup completed (status:', sub.status, ')\n');

        const now = new Date();
        const periodStart = now.toISOString();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // ============================================================
        // Test 1: Registrar pago 'paid' y reactivar suscripción
        // ============================================================
        console.log('--- Test 1: Pago paid → reactiva ---');
        const res1 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: 2500.00,
                currency: 'DOP',
                paymentMethod: 'transfer',
                reference: 'TRF-123456',
                periodStart,
                periodEnd,
                status: 'paid',
                notes: 'Pago por transferencia'
            })
        });

        await test('status 201', res1.status === 201, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('payment status is paid',
            res1.body?.data?.payment?.status === 'paid');
        await test('payment amount matches',
            Number(res1.body?.data?.payment?.amount) === 2500.00);
        await test('payment reference set',
            res1.body?.data?.payment?.reference === 'TRF-123456');
        await test('paidAt is set',
            !!res1.body?.data?.payment?.paidAt);
        await test('subscription status is active',
            res1.body?.data?.subscription?.status === 'active');
        await test('subscription cancelledAt reset',
            res1.body?.data?.subscription?.cancelledAt === null);
        await test('subscription endsAt reset',
            res1.body?.data?.subscription?.endsAt === null);
        await test('subscription invoicesUsedThisMonth reset',
            res1.body?.data?.subscription?.invoicesUsedThisMonth === 0);

        // ============================================================
        // Test 2: Pago 'pending' NO cambia la suscripción
        // ============================================================
        console.log('\n--- Test 2: Pago pending NO cambia ---');
        const subBefore = await Subscription.findByPk(subscriptionId);
        const statusBefore = subBefore.status;
        const periodBefore = subBefore.currentPeriodEnd;

        const res2 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: 500.00,
                periodStart,
                periodEnd,
                status: 'pending'
            })
        });

        await test('status 201', res2.status === 201);
        await test('payment status is pending',
            res2.body?.data?.payment?.status === 'pending');
        await test('paidAt is null',
            res2.body?.data?.payment?.paidAt === null);

        const subAfter = await Subscription.findByPk(subscriptionId);
        await test('subscription status unchanged',
            subAfter.status === statusBefore);
        await test('subscription periodEnd unchanged',
            new Date(subAfter.currentPeriodEnd).getTime() === new Date(periodBefore).getTime());

        // ============================================================
        // Test 3: periodEnd <= periodStart → 400
        // ============================================================
        console.log('\n--- Test 3: periodEnd inválido ---');
        const res3 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: 100,
                periodStart,
                periodEnd: periodStart   // igual, no mayor
            })
        });

        await test('status 400', res3.status === 400, `got ${res3.status}`);
        await test('code VALIDATION_ERROR',
            res3.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 4: amount <= 0 → 400
        // ============================================================
        console.log('\n--- Test 4: amount inválido ---');
        const res4 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: -50,
                periodStart,
                periodEnd
            })
        });

        await test('status 400', res4.status === 400);

        // ============================================================
        // Test 5: paymentMethod inválido → 400
        // ============================================================
        console.log('\n--- Test 5: paymentMethod inválido ---');
        const res5 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: 100,
                paymentMethod: 'bitcoin',
                periodStart,
                periodEnd
            })
        });

        await test('status 400', res5.status === 400);

        // ============================================================
        // Test 6: Suscripción no existe → 404
        // ============================================================
        console.log('\n--- Test 6: Suscripción no existe ---');
        const res6 = await request('/api/subscriptions/00000000-0000-0000-0000-000000000000/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                amount: 100,
                periodStart,
                periodEnd
            })
        });

        await test('status 404', res6.status === 404);
        await test('code SUBSCRIPTION_NOT_FOUND',
            res6.body?.error?.code === 'SUBSCRIPTION_NOT_FOUND');

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 100, periodStart, periodEnd })
        });
        await test('status 401', res7.status === 401);

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
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();