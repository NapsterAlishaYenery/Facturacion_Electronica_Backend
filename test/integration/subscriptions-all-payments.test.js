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
    const testRncs = ['130999701', '130999702'];
    const testEmails = [
        'all-payments-a@expedinap.com',
        'all-payments-b@expedinap.com'
    ];
    let adminCookie = null;
    const companyIds = [];
    const subscriptionIds = [];

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        for (const rnc of testRncs) {
            const old = await Company.findOne({ where: { rnc } });
            if (old) {
                await AuditLog.destroy({ where: { companyId: old.id } });
                await SubscriptionPayment.destroy({ where: { companyId: old.id } });
                await Subscription.destroy({ where: { companyId: old.id } });
                await Sequence.destroy({ where: { companyId: old.id } });
                await User.destroy({ where: { companyId: old.id } });
                await Company.destroy({ where: { id: old.id } });
            }
        }

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // Setup: 2 empresas con 3 pagos cada una
        for (let i = 0; i < 2; i++) {
            const reg = await request('/api/auth/register-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company: { rnc: testRncs[i], name: `All Payments Co ${i}` },
                    owner: {
                        email: testEmails[i],
                        password: 'SecurePass123',
                        firstName: `Test${i}`,
                        lastName: 'User'
                    }
                })
            });
            const cid = reg.body?.data?.company?.id;
            companyIds.push(cid);

            const sub = await Subscription.findOne({ where: { companyId: cid } });
            subscriptionIds.push(sub.id);

            // Crear 3 pagos por empresa
            const now = new Date();
            const statuses = ['paid', 'pending', 'failed'];
            for (let j = 0; j < 3; j++) {
                const ps = new Date(now.getTime() - j * 30 * 24 * 60 * 60 * 1000);
                const pe = new Date(ps.getTime() + 30 * 24 * 60 * 60 * 1000);
                await SubscriptionPayment.create({
                    subscriptionId: sub.id,
                    companyId: cid,
                    amount: 1000 + i * 500 + j * 100,
                    currency: 'DOP',
                    paymentMethod: j === 0 ? 'transfer' : 'cash',
                    periodStart: ps,
                    periodEnd: pe,
                    status: statuses[j],
                    paidAt: statuses[j] === 'paid' ? ps : null
                });
            }
        }

        console.log('✅ Setup completed (2 companies, 6 payments)\n');

        // ============================================================
        // Test 1: Listar todos los pagos
        // ============================================================
        console.log('--- Test 1: Listar todos ---');
        const res1 = await request('/api/subscriptions/payments', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('items is array', Array.isArray(res1.body?.data?.items));
        await test('totalItems >= 6', res1.body?.data?.pagination?.totalItems >= 6);
        await test('first item has company',
            !!res1.body?.data?.items?.[0]?.company);
        await test('first item has subscription',
            !!res1.body?.data?.items?.[0]?.subscription);

        // ============================================================
        // Test 2: Filtro status=paid
        // ============================================================
        console.log('\n--- Test 2: Filtro status=paid ---');
        const res2 = await request('/api/subscriptions/payments?status=paid', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res2.status === 200);
        await test('all paid',
            res2.body?.data?.items?.every(p => p.status === 'paid'));
        await test('at least 2 paid', res2.body?.data?.items?.length >= 2);

        // ============================================================
        // Test 3: Filtro companyId
        // ============================================================
        console.log('\n--- Test 3: Filtro companyId ---');
        const res3 = await request(`/api/subscriptions/payments?companyId=${companyIds[0]}`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res3.status === 200);
        await test('3 items returned', res3.body?.data?.items?.length === 3);
        await test('all from company A',
            res3.body?.data?.items?.every(p => p.companyId === companyIds[0]));

        // ============================================================
        // Test 4: Filtro subscriptionId
        // ============================================================
        console.log('\n--- Test 4: Filtro subscriptionId ---');
        const res4 = await request(`/api/subscriptions/payments?subscriptionId=${subscriptionIds[1]}`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res4.status === 200);
        await test('3 items returned', res4.body?.data?.items?.length === 3);
        await test('all from sub B',
            res4.body?.data?.items?.every(p => p.subscriptionId === subscriptionIds[1]));

        // ============================================================
        // Test 5: Búsqueda por nombre de empresa
        // ============================================================
        console.log('\n--- Test 5: Búsqueda por nombre ---');
        const res5 = await request('/api/subscriptions/payments?search=All Payments Co 1', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res5.status === 200);
        await test('3 items returned', res5.body?.data?.items?.length === 3);
        await test('all from company B',
            res5.body?.data?.items?.every(p => p.companyId === companyIds[1]));

        // ============================================================
        // Test 6: Filtro paymentMethod
        // ============================================================
        console.log('\n--- Test 6: Filtro paymentMethod=transfer ---');
        const res6 = await request('/api/subscriptions/payments?paymentMethod=transfer', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res6.status === 200);
        await test('all transfer',
            res6.body?.data?.items?.every(p => p.paymentMethod === 'transfer'));

        // ============================================================
        // Test 7: Paginación
        // ============================================================
        console.log('\n--- Test 7: Paginación limit=2 ---');
        const res7 = await request('/api/subscriptions/payments?limit=2&page=1', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res7.status === 200);
        await test('2 items returned', res7.body?.data?.items?.length === 2);
        await test('hasNextPage true', res7.body?.data?.pagination?.hasNextPage === true);

        // ============================================================
        // Test 8: REGRESIÓN — /:id/payments sigue funcionando
        // ============================================================
        console.log('\n--- Test 8: /:id/payments sigue funcionando ---');
        const res8 = await request(`/api/subscriptions/${subscriptionIds[0]}/payments`, {
            headers: { 'Cookie': adminCookie }
        });
        await test('status 200', res8.status === 200, `got ${res8.status}`);
        await test('3 items returned', res8.body?.data?.items?.length === 3);

        // ============================================================
        // Test 9: REGRESIÓN — /me sigue funcionando
        // ============================================================
        console.log('\n--- Test 9: /me sigue funcionando ---');
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmails[0],
                password: 'SecurePass123'
            })
        });
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const ownerCookie = cookies.find(c => c?.startsWith('access_token='))?.split(';')[0];

        const res9 = await request('/api/subscriptions/me', {
            headers: { 'Cookie': ownerCookie }
        });
        await test('status 200', res9.status === 200);
        await test('returns own sub',
            res9.body?.data?.subscription?.id === subscriptionIds[0]);

        // ============================================================
        // Test 10: Status inválido → 400
        // ============================================================
        console.log('\n--- Test 10: Status inválido ---');
        const res10 = await request('/api/subscriptions/payments?status=bogus', {
            headers: { 'Cookie': adminCookie }
        });
        await test('status 400', res10.status === 400);
        await test('code VALIDATION_ERROR',
            res10.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 11: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 11: Sin auth ---');
        const res11 = await request('/api/subscriptions/payments');
        await test('status 401', res11.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            for (const cid of companyIds) {
                await AuditLog.destroy({ where: { companyId: cid } });
                await SubscriptionPayment.destroy({ where: { companyId: cid } });
                await Subscription.destroy({ where: { companyId: cid } });
                await Sequence.destroy({ where: { companyId: cid } });
                await User.destroy({ where: { companyId: cid } });
                await Company.destroy({ where: { id: cid } });
            }
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();