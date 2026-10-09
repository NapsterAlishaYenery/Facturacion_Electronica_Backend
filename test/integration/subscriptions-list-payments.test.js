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
    const testRnc = '130999601';
    const testEmail = 'list-payments-test@expedinap.com';
    let adminCookie = null;
    let companyId = null;
    let subscriptionId = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

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

        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'List Payments Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'List',
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

        // Crear 5 pagos con distintos status
        const now = new Date();
        const statuses = ['paid', 'paid', 'pending', 'failed', 'refunded'];
        for (let i = 0; i < 5; i++) {
            const ps = new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000);
            const pe = new Date(ps.getTime() + 30 * 24 * 60 * 60 * 1000);
            await SubscriptionPayment.create({
                subscriptionId,
                companyId,
                amount: 1000 + i * 100,
                currency: 'DOP',
                paymentMethod: 'transfer',
                periodStart: ps,
                periodEnd: pe,
                status: statuses[i],
                paidAt: statuses[i] === 'paid' ? ps : null
            });
        }

        console.log('✅ Setup completed (5 payments)\n');

        // ============================================================
        // Test 1: Listar todos los pagos
        // ============================================================
        console.log('--- Test 1: Listar todos ---');
        const res1 = await request(`/api/subscriptions/${subscriptionId}/payments`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('5 items returned', res1.body?.data?.items?.length === 5);
        await test('totalItems is 5', res1.body?.data?.pagination?.totalItems === 5);
        await test('subscription context present',
            res1.body?.data?.subscription?.id === subscriptionId);

        // ============================================================
        // Test 2: Filtro status=paid
        // ============================================================
        console.log('\n--- Test 2: Filtro status=paid ---');
        const res2 = await request(`/api/subscriptions/${subscriptionId}/payments?status=paid`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res2.status === 200);
        await test('2 items returned', res2.body?.data?.items?.length === 2);
        await test('all paid',
            res2.body?.data?.items?.every(p => p.status === 'paid'));

        // ============================================================
        // Test 3: Paginación
        // ============================================================
        console.log('\n--- Test 3: Paginación ---');
        const res3 = await request(`/api/subscriptions/${subscriptionId}/payments?limit=2&page=1`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res3.status === 200);
        await test('2 items returned', res3.body?.data?.items?.length === 2);
        await test('totalPages is 3', res3.body?.data?.pagination?.totalPages === 3);
        await test('hasNextPage true', res3.body?.data?.pagination?.hasNextPage === true);

        // ============================================================
        // Test 4: Suscripción inexistente → 404
        // ============================================================
        console.log('\n--- Test 4: Suscripción inexistente ---');
        const res4 = await request('/api/subscriptions/00000000-0000-0000-0000-000000000000/payments', {
            headers: { 'Cookie': adminCookie }
        });
        await test('status 404', res4.status === 404, `got ${res4.status}`);
        await test('code SUBSCRIPTION_NOT_FOUND',
            res4.body?.error?.code === 'SUBSCRIPTION_NOT_FOUND');

        // ============================================================
        // Test 5: UUID inválido → 400
        // ============================================================
        console.log('\n--- Test 5: UUID inválido ---');
        const res5 = await request('/api/subscriptions/not-a-uuid/payments', {
            headers: { 'Cookie': adminCookie }
        });
        await test('status 400', res5.status === 400, `got ${res5.status}`);
        await test('code INVALID_ID_FORMAT',
            res5.body?.error?.code === 'INVALID_ID_FORMAT');

        // ============================================================
        // Test 6: Status inválido → 400
        // ============================================================
        console.log('\n--- Test 6: Status inválido ---');
        const res6 = await request(`/api/subscriptions/${subscriptionId}/payments?status=bogus`, {
            headers: { 'Cookie': adminCookie }
        });
        await test('status 400', res6.status === 400);
        await test('code VALIDATION_ERROR',
            res6.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request(`/api/subscriptions/${subscriptionId}/payments`);
        await test('status 401', res7.status === 401);

        // ============================================================
        // Test 8: REGRESIÓN — /me sigue funcionando
        // ============================================================
        console.log('\n--- Test 8: /me sigue funcionando ---');
        // Login como owner
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const ownerCookie = cookies.find(c => c?.startsWith('access_token='))?.split(';')[0];

        const res8 = await request('/api/subscriptions/me', {
            headers: { 'Cookie': ownerCookie }
        });
        await test('status 200', res8.status === 200, `got ${res8.status}`);
        await test('returns own subscription',
            res8.body?.data?.subscription?.id === subscriptionId);

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