require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, SubscriptionPayment, Sequence, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    const testRnc = '130999888';
    const testEmail = 'my-payments-test@expedinap.com';
    let companyId = null;
    let subscriptionId = null;
    let accessCookie = null;
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

        // Setup: registrar empresa + owner
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'My Payments Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Payments',
                    lastName: 'Tester'
                }
            })
        });
        companyId = registerRes.body?.data?.company?.id;

        // Login para cookie
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail, password: 'SecurePass123' })
        });

        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
        accessCookie = accessCookieFull?.split(';')[0];

        // Buscar la suscripción
        const sub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        subscriptionId = sub.id;

        // Setup: crear 5 pagos con distintos status
        const now = new Date();
        const paymentData = [
            { status: 'paid',     amount: 1000, method: 'transfer', offsetDays: -60 },
            { status: 'paid',     amount: 1000, method: 'transfer', offsetDays: -30 },
            { status: 'failed',   amount: 1000, method: 'card',     offsetDays: -15 },
            { status: 'pending',  amount: 1000, method: null,       offsetDays: -5 },
            { status: 'refunded', amount: 1000, method: 'stripe',   offsetDays: -2 }
        ];

        for (const p of paymentData) {
            const periodStart = new Date(now.getTime() + p.offsetDays * 24 * 60 * 60 * 1000);
            const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

            const payment = await SubscriptionPayment.create({
                subscriptionId,
                companyId,
                amount: p.amount,
                currency: 'DOP',
                paymentMethod: p.method,
                periodStart,
                periodEnd,
                status: p.status,
                paidAt: p.status === 'paid' ? periodStart : null
            });
            createdPaymentIds.push(payment.id);
        }

        console.log('✅ Setup completed (5 payments creados)\n');

        // ============================================================
        // Test 1: Listar todos los pagos (sin filtro)
        // ============================================================
        console.log('--- Test 1: Listar todos ---');
        const res1 = await request('/api/subscriptions/me/payments', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('5 items returned', res1.body?.data?.items?.length === 5);
        await test('totalItems is 5', res1.body?.data?.pagination?.totalItems === 5);

        // ============================================================
        // Test 2: Orden por createdAt DESC
        // ============================================================
        console.log('\n--- Test 2: Orden DESC ---');
        const items = res1.body?.data?.items || [];
        const firstCreatedAt = new Date(items[0]?.createdAt).getTime();
        const lastCreatedAt = new Date(items[items.length - 1]?.createdAt).getTime();
        await test('first is newer than last', firstCreatedAt >= lastCreatedAt);

        // ============================================================
        // Test 3: Filtro por status=paid
        // ============================================================
        console.log('\n--- Test 3: Filtro status=paid ---');
        const res3 = await request('/api/subscriptions/me/payments?status=paid', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res3.status === 200);
        await test('2 items returned', res3.body?.data?.items?.length === 2);
        await test('all statuses are paid',
            res3.body?.data?.items?.every(p => p.status === 'paid'));

        // ============================================================
        // Test 4: Filtro status inválido → 400
        // ============================================================
        console.log('\n--- Test 4: Status inválido ---');
        const res4 = await request('/api/subscriptions/me/payments?status=bogus', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 400', res4.status === 400, `got ${res4.status}`);
        await test('code VALIDATION_ERROR',
            res4.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 5: Paginación limit=2
        // ============================================================
        console.log('\n--- Test 5: Paginación limit=2 ---');
        const res5 = await request('/api/subscriptions/me/payments?page=1&limit=2', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res5.status === 200);
        await test('2 items returned', res5.body?.data?.items?.length === 2);
        await test('totalPages is 3', res5.body?.data?.pagination?.totalPages === 3);
        await test('hasNextPage true', res5.body?.data?.pagination?.hasNextPage === true);
        await test('hasPrevPage false', res5.body?.data?.pagination?.hasPrevPage === false);

        // ============================================================
        // Test 6: Página 3 tiene 1 item
        // ============================================================
        console.log('\n--- Test 6: Página 3 ---');
        const res6 = await request('/api/subscriptions/me/payments?page=3&limit=2', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res6.status === 200);
        await test('1 item returned', res6.body?.data?.items?.length === 1);
        await test('hasNextPage false', res6.body?.data?.pagination?.hasNextPage === false);
        await test('hasPrevPage true', res6.body?.data?.pagination?.hasPrevPage === true);

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request('/api/subscriptions/me/payments');
        await test('status 401', res7.status === 401, `got ${res7.status}`);

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