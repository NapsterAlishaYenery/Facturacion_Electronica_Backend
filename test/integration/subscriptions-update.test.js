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
    const testRnc = '130999401';
    const testEmail = 'update-sub-test@expedinap.com';
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
                company: { rnc: testRnc, name: 'Update Sub Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Update',
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

        // ============================================================
        // Test 1: Bloquear suscripción (active/trial → expired)
        // ============================================================
        console.log('--- Test 1: Bloquear (expired) ---');
        const res1 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ status: 'expired' })
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('subscription status is expired',
            res1.body?.data?.subscription?.status === 'expired');

        // ============================================================
        // Test 2: Reactivar (expired → active) limpia cancelledAt/endsAt
        // ============================================================
        console.log('\n--- Test 2: Reactivar (active) ---');
        // Primero lo cancelamos para tener cancelledAt/endsAt seteados
        await Subscription.update(
            {
                status: 'cancelled',
                cancelledAt: new Date(),
                endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
            },
            { where: { id: subscriptionId } }
        );

        const res2 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ status: 'active' })
        });

        await test('status 200', res2.status === 200, `got ${res2.status}`);
        await test('status is active',
            res2.body?.data?.subscription?.status === 'active');
        await test('cancelledAt is null',
            res2.body?.data?.subscription?.cancelledAt === null);
        await test('endsAt is null',
            res2.body?.data?.subscription?.endsAt === null);

        // ============================================================
        // Test 3: Extender currentPeriodEnd
        // ============================================================
        console.log('\n--- Test 3: Extender período ---');
        const newEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
        const res3 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ currentPeriodEnd: newEnd })
        });

        await test('status 200', res3.status === 200, `got ${res3.status}`);
        const returnedEnd = new Date(res3.body?.data?.subscription?.currentPeriodEnd).getTime();
        const expectedEnd = new Date(newEnd).getTime();
        await test('currentPeriodEnd updated', returnedEnd === expectedEnd);

        // ============================================================
        // Test 4: Resetear invoicesUsedThisMonth
        // ============================================================
        console.log('\n--- Test 4: Resetear contador ---');
        await Subscription.update(
            { invoicesUsedThisMonth: 50 },
            { where: { id: subscriptionId } }
        );

        const res4 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ invoicesUsedThisMonth: 0 })
        });

        await test('status 200', res4.status === 200);
        await test('counter reset',
            res4.body?.data?.subscription?.invoicesUsedThisMonth === 0);

        // ============================================================
        // Test 5: Sin cambios → 400 NO_CHANGES_DETECTED
        // ============================================================
        console.log('\n--- Test 5: Sin cambios ---');
        const res5 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ status: 'active' })
        });

        await test('status 400', res5.status === 400, `got ${res5.status}`);
        await test('code NO_CHANGES_DETECTED',
            res5.body?.error?.code === 'NO_CHANGES_DETECTED');

        // ============================================================
        // Test 6: Body vacío → 400
        // ============================================================
        console.log('\n--- Test 6: Body vacío ---');
        const res6 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({})
        });

        await test('status 400', res6.status === 400);
        await test('code VALIDATION_ERROR',
            res6.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 7: Status inválido → 400
        // ============================================================
        console.log('\n--- Test 7: Status inválido ---');
        const res7 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ status: 'bogus' })
        });

        await test('status 400', res7.status === 400);
        await test('code VALIDATION_ERROR',
            res7.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 8: Suscripción no existe → 404
        // ============================================================
        console.log('\n--- Test 8: No existe ---');
        const res8 = await request('/api/subscriptions/00000000-0000-0000-0000-000000000000', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ status: 'active' })
        });

        await test('status 404', res8.status === 404);
        await test('code SUBSCRIPTION_NOT_FOUND',
            res8.body?.error?.code === 'SUBSCRIPTION_NOT_FOUND');

        // ============================================================
        // Test 9: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 9: Sin auth ---');
        const res9 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'expired' })
        });
        await test('status 401', res9.status === 401);

        // ============================================================
        // Test 10: Campo no permitido (planId) se ignora
        // ============================================================
        console.log('\n--- Test 10: planId ignorado ---');
        const originalPlanId = (await Subscription.findByPk(subscriptionId)).planId;

        const res10 = await request(`/api/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                status: 'expired',
                planId: '00000000-0000-0000-0000-000000000000'
            })
        });

        await test('status 200', res10.status === 200);
        const afterPlanId = (await Subscription.findByPk(subscriptionId)).planId;
        await test('planId unchanged', afterPlanId === originalPlanId);

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