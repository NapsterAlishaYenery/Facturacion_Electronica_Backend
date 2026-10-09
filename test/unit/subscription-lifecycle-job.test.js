// ============================================================
// Test: subscription-lifecycle.job
// Verifica la NUEVA lógica:
//   1. No cambia status automáticamente (trial/past_due/expired
//      quedan intactos).
//   2. Renueva períodos vencidos: crea SubscriptionPayment pending
//      y avanza currentPeriodStart/End + resetea invoicesUsedThisMonth.
//   3. Notifica en días clave (opcional — depende del módulo de
//      notifications, se puede saltar).
// ============================================================

require('dotenv').config();
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, SubscriptionPayment, Plan, Sequence, AuditLog
} = require('../../src/models');

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

(async () => {
    const testRnc = '130999901';
    const testEmail = 'lifecycle-job-test@expedinap.com';
    const planCode = 'test_7_17_plan';
    const DAY_MS = 24 * 60 * 60 * 1000;

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

        // Setup
        const plan = await Plan.create({
            code: planCode,
            name: 'Test 7.17 Plan',
            priceDop: 1500,
            invoicesPerMonth: 100,
            maxUsers: 5,
            maxSequences: 3
        });
        planId = plan.id;

        const company = await Company.create({
            rnc: testRnc,
            name: 'Lifecycle Test Co',
            email: testEmail
        });
        companyId = company.id;

        await User.create({
            companyId,
            email: testEmail,
            passwordHash: 'dummy',
            firstName: 'Lifecycle',
            lastName: 'Test',
            role: 'company_admin',
            isActive: true
        });

        // Caso 1: active vencido → debe renovar
        const activeExpired = await Subscription.create({
            companyId,
            planId,
            status: 'active',
            startsAt: new Date(Date.now() - 60 * DAY_MS),
            currentPeriodStart: new Date(Date.now() - 35 * DAY_MS),
            currentPeriodEnd: new Date(Date.now() - 5 * DAY_MS), // venció hace 5d
            invoicesUsedThisMonth: 42
        });

        // Caso 2: trial vencido → NO debe tocarlo
        const trialExpired = await Subscription.create({
            companyId,
            planId,
            status: 'trial',
            startsAt: new Date(Date.now() - 40 * DAY_MS),
            trialEndsAt: new Date(Date.now() - 10 * DAY_MS),
            currentPeriodStart: new Date(Date.now() - 40 * DAY_MS),
            currentPeriodEnd: new Date(Date.now() - 10 * DAY_MS)
        });

        // Caso 3: past_due viejo → NO debe tocarlo
        const pastDueOld = await Subscription.create({
            companyId,
            planId,
            status: 'past_due',
            startsAt: new Date(Date.now() - 90 * DAY_MS),
            currentPeriodStart: new Date(Date.now() - 60 * DAY_MS),
            currentPeriodEnd: new Date(Date.now() - 30 * DAY_MS)
        });

        console.log('✅ Setup completed (3 subs)\n');

        // Ejecutar el job directamente (sin scheduler)
        const job = require('../../src/modules/jobs/jobs/subscription-lifecycle.job');
        console.log('--- Ejecutando job ---');
        const result = await job._raw();
        console.log('   Resultado:', JSON.stringify(result, null, 2), '\n');

        // ============================================================
        // Test 1: active vencido fue renovado
        // ============================================================
        console.log('--- Caso 1: active vencido ---');
        await activeExpired.reload();
        test('status sigue active',
            activeExpired.status === 'active',
            `got ${activeExpired.status}`);
        test('invoicesUsedThisMonth reset a 0',
            activeExpired.invoicesUsedThisMonth === 0);
        const newEnd = new Date(activeExpired.currentPeriodEnd).getTime();
        test('currentPeriodEnd avanzado ~30 días',
            newEnd > Date.now() + 29 * DAY_MS && newEnd < Date.now() + 31 * DAY_MS);

        const payments = await SubscriptionPayment.findAll({
            where: { subscriptionId: activeExpired.id }
        });
        test('1 payment pending creado', payments.length === 1);
        test('payment status pending', payments[0]?.status === 'pending');
        test('payment amount matches plan',
            Number(payments[0]?.amount) === 1500);
        test('payment currency DOP', payments[0]?.currency === 'DOP');

        // ============================================================
        // Test 2: trial vencido NO fue tocado
        // ============================================================
        console.log('\n--- Caso 2: trial vencido ---');
        await trialExpired.reload();
        test('status sigue trial',
            trialExpired.status === 'trial',
            `got ${trialExpired.status}`);
        const trialPayments = await SubscriptionPayment.findAll({
            where: { subscriptionId: trialExpired.id }
        });
        test('sin payments creados', trialPayments.length === 0);

        // ============================================================
        // Test 3: past_due viejo NO fue tocado
        // ============================================================
        console.log('\n--- Caso 3: past_due viejo ---');
        await pastDueOld.reload();
        test('status sigue past_due',
            pastDueOld.status === 'past_due',
            `got ${pastDueOld.status}`);
        const pastDuePayments = await SubscriptionPayment.findAll({
            where: { subscriptionId: pastDueOld.id }
        });
        test('sin payments creados', pastDuePayments.length === 0);

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