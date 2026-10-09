require('dotenv').config();
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, SubscriptionPayment, Plan, Sequence, AuditLog
} = require('../../src/models');
const {
    getActiveSubscription,
    countActiveUsers,
    countActiveSequences,
    getPlanLimit,
    assertSubscriptionActive,
    assertSubscriptionCanUse
} = require('../../src/shared/utils/subscription.helpers');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

async function expectAppError(fn, expectedCode) {
    try {
        await fn();
        return { threw: false, code: null };
    } catch (err) {
        return { threw: true, code: err.code, statusCode: err.statusCode };
    }
}

(async () => {
    const testRnc = '130999801';
    const testEmail = 'helpers-test@expedinap.com';
    const planCode = 'test_7_16_plan';
    let companyId = null;
    let planId = null;
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
        await Plan.destroy({ where: { code: planCode } });

        // Setup: plan con límites pequeños para testear
        const plan = await Plan.create({
            code: planCode,
            name: 'Test 7.16 Plan',
            priceDop: 500,
            invoicesPerMonth: 3,
            maxUsers: 2,
            maxSequences: 1
        });
        planId = plan.id;

        // Setup: empresa + usuario owner
        const registerRes = await require('../../src/models').User.create({
            email: testEmail,
            passwordHash: 'dummy',
            firstName: 'Helpers',
            lastName: 'Test',
            role: 'company_admin',
            isActive: true
        }).then(async () => null).catch(() => null);
        // ^ No usamos register-company porque es HTTP. Creamos directo.

        // Creamos company manualmente
        const company = await Company.create({
            rnc: testRnc,
            name: 'Helpers Test Co'
        });
        companyId = company.id;

        // Creamos owner
        const owner = await User.create({
            companyId,
            email: testEmail,
            passwordHash: 'dummy-not-used',
            firstName: 'Helpers',
            lastName: 'Test',
            role: 'company_admin',
            isActive: true
        });

        // Creamos subscription
        const sub = await Subscription.create({
            companyId,
            planId,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            invoicesUsedThisMonth: 0
        });
        subscriptionId = sub.id;

        console.log('✅ Setup completed\n');

        // ============================================================
        // getPlanLimit
        // ============================================================
        console.log('--- getPlanLimit ---');
        test('invoices limit = 3', getPlanLimit(plan, 'invoices') === 3);
        test('users limit = 2', getPlanLimit(plan, 'users') === 2);
        test('sequences limit = 1', getPlanLimit(plan, 'sequences') === 1);
        test('null plan → 0', getPlanLimit(null, 'invoices') === 0);

        let threw = false;
        try { getPlanLimit(plan, 'bogus'); } catch (e) { threw = true; }
        test('unknown resource throws', threw);

        // ============================================================
        // getActiveSubscription
        // ============================================================
        console.log('\n--- getActiveSubscription ---');
        const activeSub = await getActiveSubscription(companyId);
        test('returns the active subscription', activeSub?.id === subscriptionId);
        test('includes plan', activeSub?.plan?.code === planCode);

        const nullSub = await getActiveSubscription('00000000-0000-0000-0000-000000000000');
        test('returns null for unknown company', nullSub === null);

        // ============================================================
        // assertSubscriptionActive
        // ============================================================
        console.log('\n--- assertSubscriptionActive ---');
        const assertSub = await assertSubscriptionActive(companyId);
        test('returns subscription when active', assertSub?.id === subscriptionId);

        const err1 = await expectAppError(
            () => assertSubscriptionActive('00000000-0000-0000-0000-000000000000'),
            'NO_ACTIVE_SUBSCRIPTION'
        );
        test('throws NO_ACTIVE_SUBSCRIPTION', err1.threw && err1.code === 'NO_ACTIVE_SUBSCRIPTION');
        test('statusCode is 403', err1.statusCode === 403);

        // ============================================================
        // assertSubscriptionCanUse - dentro del límite
        // ============================================================
        console.log('\n--- assertSubscriptionCanUse - OK ---');
        const okInvoices = await assertSubscriptionCanUse(companyId, 'invoices');
        test('invoices OK (0/3)', okInvoices?.id === subscriptionId);

        const okUsers = await assertSubscriptionCanUse(companyId, 'users');
        test('users OK (1/2)', okUsers?.id === subscriptionId);

        const okSeq = await assertSubscriptionCanUse(companyId, 'sequences');
        test('sequences OK (0/1)', okSeq?.id === subscriptionId);

        // ============================================================
        // assertSubscriptionCanUse - límite alcanzado (invoices)
        // ============================================================
        console.log('\n--- assertSubscriptionCanUse - LIMIT (invoices) ---');
        await Subscription.update(
            { invoicesUsedThisMonth: 3 },
            { where: { id: subscriptionId } }
        );

        const errInv = await expectAppError(
            () => assertSubscriptionCanUse(companyId, 'invoices'),
            'RESOURCE_LIMIT_REACHED'
        );
        test('throws RESOURCE_LIMIT_REACHED (invoices)',
            errInv.threw && errInv.code === 'RESOURCE_LIMIT_REACHED');

        // Resetear contador
        await Subscription.update(
            { invoicesUsedThisMonth: 0 },
            { where: { id: subscriptionId } }
        );

        // ============================================================
        // assertSubscriptionCanUse - límite alcanzado (users)
        // ============================================================
        console.log('\n--- assertSubscriptionCanUse - LIMIT (users) ---');
        // Ya hay 1 owner. Agregamos 1 más para llegar al límite de 2
        const extraUser = await User.create({
            companyId,
            email: 'helpers-extra@expedinap.com',
            passwordHash: 'dummy',
            firstName: 'Extra',
            lastName: 'User',
            role: 'operator',
            isActive: true
        });

        const errUsers = await expectAppError(
            () => assertSubscriptionCanUse(companyId, 'users'),
            'RESOURCE_LIMIT_REACHED'
        );
        test('throws RESOURCE_LIMIT_REACHED (users)',
            errUsers.threw && errUsers.code === 'RESOURCE_LIMIT_REACHED');

        // Limpiar usuario extra
        await extraUser.destroy();

        // ============================================================
        // assertSubscriptionCanUse - ilimitado (-1)
        // ============================================================
        console.log('\n--- assertSubscriptionCanUse - unlimited ---');
        await Plan.update(
            { invoicesPerMonth: -1 },
            { where: { id: planId } }
        );
        await Subscription.update(
            { invoicesUsedThisMonth: 999999 },
            { where: { id: subscriptionId } }
        );

        const unlimitedSub = await assertSubscriptionCanUse(companyId, 'invoices');
        test('unlimited plan always OK', unlimitedSub?.id === subscriptionId);

        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

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
            if (planId) await Plan.destroy({ where: { id: planId } });
            await Plan.destroy({ where: { code: planCode } });
            console.log('🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(failed > 0 ? 1 : 0);
    }
})();