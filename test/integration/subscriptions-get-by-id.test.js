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
    const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
    return accessCookieFull?.split(';')[0];
}

(async () => {
    const testRnc = '130999301';
    const testEmail = 'get-by-id-test@expedinap.com';
    let adminCookie = null;
    let companyId = null;
    let subscriptionId = null;
    const createdPaymentIds = [];

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
                company: { rnc: testRnc, name: 'Get By Id Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Detail',
                    lastName: 'Tester'
                }
            })
        });
        companyId = registerRes.body?.data?.company?.id;

        // Buscar subscription
        const sub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        subscriptionId = sub.id;

        // Crear 3 pagos para probar el include
        const now = new Date();
        for (let i = 0; i < 3; i++) {
            const periodStart = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000);
            const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
            const payment = await SubscriptionPayment.create({
                subscriptionId,
                companyId,
                amount: 1000 + i * 100,
                currency: 'DOP',
                paymentMethod: 'transfer',
                periodStart,
                periodEnd,
                status: 'paid',
                paidAt: periodStart
            });
            createdPaymentIds.push(payment.id);
        }

        console.log('✅ Setup completed (1 sub + 3 payments)\n');

        // ============================================================
        // Test 1: Obtener suscripción por ID
        // ============================================================
        console.log('--- Test 1: Obtener por ID ---');
        const res1 = await request(`/api/subscriptions/${subscriptionId}`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('subscription id matches',
            res1.body?.data?.subscription?.id === subscriptionId);
        await test('company included',
            res1.body?.data?.company?.id === companyId);
        await test('plan included',
            !!res1.body?.data?.plan?.id);
        await test('payments included',
            Array.isArray(res1.body?.data?.payments));
        await test('3 payments returned',
            res1.body?.data?.payments?.length === 3);
        await test('usage block present',
            !!res1.body?.data?.usage);
        await test('usage has invoices',
            typeof res1.body?.data?.usage?.invoices?.used === 'number');
        await test('usage has users',
            typeof res1.body?.data?.usage?.users?.used === 'number');
        await test('usage has sequences',
            typeof res1.body?.data?.usage?.sequences?.used === 'number');
        await test('expiresAt is present',
            !!res1.body?.data?.expiresAt);
        await test('daysLeft is number',
            typeof res1.body?.data?.daysLeft === 'number');

        // ============================================================
        // Test 2: Suscripción no existe → 404
        // ============================================================
        console.log('\n--- Test 2: Suscripción inexistente ---');
        const res2 = await request('/api/subscriptions/00000000-0000-0000-0000-000000000000', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 404', res2.status === 404, `got ${res2.status}`);
        await test('code SUBSCRIPTION_NOT_FOUND',
            res2.body?.error?.code === 'SUBSCRIPTION_NOT_FOUND');

        // ============================================================
        // Test 3: UUID inválido → 400
        // ============================================================
        console.log('\n--- Test 3: UUID inválido ---');
        const res3 = await request('/api/subscriptions/not-a-uuid', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 400', res3.status === 400, `got ${res3.status}`);
        await test('code INVALID_ID_FORMAT',
            res3.body?.error?.code === 'INVALID_ID_FORMAT');

        // ============================================================
        // Test 4: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 4: Sin auth ---');
        const res4 = await request(`/api/subscriptions/${subscriptionId}`);
        await test('status 401', res4.status === 401, `got ${res4.status}`);

        // ============================================================
        // Test 5: Con company_admin (rol insuficiente) → 403
        // ============================================================
        console.log('\n--- Test 5: Rol insuficiente ---');
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'SecurePass123'
            })
        });
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const ownerCookie = cookies.find(c => c?.startsWith('access_token='))?.split(';')[0];

        const res5 = await request(`/api/subscriptions/${subscriptionId}`, {
            headers: { 'Cookie': ownerCookie }
        });
        await test('status 403', res5.status === 403, `got ${res5.status}`);
        await test('code INSUFFICIENT_ROLE',
            res5.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // Test 6: /me sigue funcionando (no fue capturado por /:id)
        // ============================================================
        console.log('\n--- Test 6: /me sigue funcionando ---');
        const res6 = await request('/api/subscriptions/me', {
            headers: { 'Cookie': ownerCookie }
        });
        await test('status 200', res6.status === 200, `got ${res6.status}`);
        await test('returns own subscription',
            res6.body?.data?.subscription?.id === subscriptionId);

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