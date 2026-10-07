require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    const testRnc = '130999777';
    const testEmail = 'subs-me-test@expedinap.com';
    const testCode = 'test_7_6_plan';
    let companyId = null;
    let planId = null;
    let accessCookie = null;
    let trialSubscriptionId = null;

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
        await Plan.destroy({ where: { code: testCode } });

        // Setup: plan de prueba
        const plan = await Plan.create({
            code: testCode,
            name: 'Plan Test 7.6',
            priceDop: 1234.00,
            priceUsd: 20.00,
            invoicesPerMonth: 100,
            maxUsers: 3,
            maxSequences: 2,
            features: { reports: true }
        });
        planId = plan.id;

        // Setup: registrar empresa + owner (crea trial automáticamente)
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Subs Me Test Co' },
                owner: {
                    email: testEmail,
                    password: 'SecurePass123',
                    firstName: 'Subs',
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

        // Buscar la suscripción creada por register-company
        const sub = await Subscription.findOne({
            where: { companyId },
            order: [['createdAt', 'DESC']]
        });
        trialSubscriptionId = sub.id;

        console.log('✅ Setup completed\n');

        // ============================================================
        // Test 1: GET /me devuelve suscripción activa
        // ============================================================
        console.log('--- Test 1: Suscripción trial recién creada ---');
        const res = await request('/api/subscriptions/me', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res.status === 200, `got ${res.status}`);
        await test('success true', res.body?.success === true);
        await test('subscription id matches',
            res.body?.data?.subscription?.id === trialSubscriptionId);
        await test('status is trial',
            res.body?.data?.subscription?.status === 'trial');
        await test('isActive true', res.body?.data?.isActive === true);
        await test('plan present', !!res.body?.data?.plan);
        await test('plan code matches', res.body?.data?.plan?.code === 'basic');
        await test('usage block present', !!res.body?.data?.usage);
        await test('usage.invoices.used is 0',
            res.body?.data?.usage?.invoices?.used === 0);
        await test('usage.users.used is 1',
            res.body?.data?.usage?.users?.used === 1);
        await test('daysLeft > 0',
            typeof res.body?.data?.daysLeft === 'number' && res.body?.data?.daysLeft > 0);

        // ============================================================
        // Test 2: Sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 2: Sin auth ---');
        const noAuthRes = await request('/api/subscriptions/me');
        await test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // Test 3: Fallback cuando solo hay expirada
        // ============================================================
        console.log('\n--- Test 3: Fallback con suscripción expirada ---');
        await Subscription.update(
            { status: 'expired' },
            { where: { id: trialSubscriptionId } }
        );

        const res3 = await request('/api/subscriptions/me', {
            headers: { 'Cookie': accessCookie }
        });

        await test('status 200', res3.status === 200, `got ${res3.status}`);
        await test('isActive false', res3.body?.data?.isActive === false);
        await test('status expired',
            res3.body?.data?.subscription?.status === 'expired');
        await test('daysLeft is 0', res3.body?.data?.daysLeft === 0);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (companyId) {
                await AuditLog.destroy({ where: { companyId } });
                await Subscription.destroy({ where: { companyId } });
                await Sequence.destroy({ where: { companyId } });
                await User.destroy({ where: { companyId } });
                await Company.destroy({ where: { id: companyId } });
            }
            if (planId) await Plan.destroy({ where: { id: planId } });
            await Plan.destroy({ where: { code: testCode } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();