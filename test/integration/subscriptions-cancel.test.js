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
    const testRnc = '130999111';
    const testEmail = 'cancel-test@expedinap.com';
    let companyId = null;
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

        // Setup: registrar empresa (crea trial automáticamente)
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Cancel Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Cancel',
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

        // Buscar subscription
        const sub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        subscriptionId = sub.id;

        console.log('✅ Setup completed (status:', sub.status, ')\n');

        // ============================================================
        // Test 1: Cancelar suscripción activa
        // ============================================================
        console.log('--- Test 1: Cancelación exitosa ---');
        const res1 = await request('/api/subscriptions/me/cancel', {
            method: 'POST',
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('subscription status is cancelled',
            res1.body?.data?.subscription?.status === 'cancelled');
        await test('cancelledAt is set',
            !!res1.body?.data?.subscription?.cancelledAt);
        await test('endsAt is set',
            !!res1.body?.data?.subscription?.endsAt);
        await test('accessUntil matches endsAt',
            res1.body?.data?.accessUntil === res1.body?.data?.subscription?.endsAt);
        await test('daysLeft is a number >= 0',
            typeof res1.body?.data?.daysLeft === 'number' && res1.body?.data?.daysLeft >= 0);

        // ============================================================
        // Test 2: Verificar en BD
        // ============================================================
        console.log('\n--- Test 2: Verificación en BD ---');
        const subAfter = await Subscription.findByPk(subscriptionId);
        await test('status cancelled in DB', subAfter.status === 'cancelled');
        await test('cancelledAt persisted', !!subAfter.cancelledAt);
        await test('endsAt persisted', !!subAfter.endsAt);

        // ============================================================
        // Test 3: Cancelar de nuevo → 404 (ya no está activa)
        // ============================================================
        console.log('\n--- Test 3: Cancelar de nuevo ---');
        const res3 = await request('/api/subscriptions/me/cancel', {
            method: 'POST',
            headers: { 'Cookie': accessCookie }
        });

        await test('status 404', res3.status === 404, `got ${res3.status}`);
        await test('code NO_ACTIVE_SUBSCRIPTION',
            res3.body?.error?.code === 'NO_ACTIVE_SUBSCRIPTION');

        // ============================================================
        // Test 4: Ver suscripción cancelada con GET /me (fallback)
        // ============================================================
        console.log('\n--- Test 4: GET /me devuelve la cancelada ---');
        const res4 = await request('/api/subscriptions/me', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res4.status === 200, `got ${res4.status}`);
        await test('isActive false', res4.body?.data?.isActive === false);
        await test('status is cancelled',
            res4.body?.data?.subscription?.status === 'cancelled');

        // ============================================================
        // Test 5: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 5: Sin auth ---');
        const res5 = await request('/api/subscriptions/me/cancel', {
            method: 'POST'
        });

        await test('status 401', res5.status === 401, `got ${res5.status}`);

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