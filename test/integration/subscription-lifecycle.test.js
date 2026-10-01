// ============================================================
// Test de integración: subscription-lifecycle.job
//
// Verifica las 3 transiciones de estado:
//   1. trial → past_due   (trial_ends_at vencido)
//   2. past_due → expired (trial_ends_at + 3d vencido)
//   3. active → past_due  (current_period_end vencido)
//
// Y verifica que NO toca:
//   - invoices_used_this_month
//   - subs vigentes (fechas futuras)
//   - subs cancelled
//
// Requiere BD real. Limpia todo al final.
//
// Uso:
//   node test/integration/subscription-lifecycle.test.js
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company, Plan, Subscription, SubscriptionPayment,
    User, AuditLog
} = require('../../src/models');

const job = require('../../src/modules/jobs/jobs/subscription-lifecycle.job');
const runJob = job._raw;

const TEST_RNC = '130999977';
const TEST_EMAIL = 'owner-sublifecycle@expedinap.com';

let companyId = null;
let planId = null;

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

function daysAgo(n) {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n) {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// ------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------
async function cleanup() {
    const old = await Company.findOne({ where: { rnc: TEST_RNC } });
    if (!old) return;

    await AuditLog.destroy({
        where: {
            [Op.or]: [
                { companyId: old.id },
                { action: { [Op.like]: 'job.subscription-lifecycle%' } }
            ]
        }
    });
    await SubscriptionPayment.destroy({ where: { companyId: old.id } });
    await Subscription.destroy({ where: { companyId: old.id } });
    await User.destroy({ where: { companyId: old.id } });
    await Company.destroy({ where: { id: old.id } });
}

// ------------------------------------------------------------
// Setup
// ------------------------------------------------------------
async function setup() {
    await cleanup();

    let plan = await Plan.findOne({ where: { code: 'basic' } });
    if (!plan) {
        plan = await Plan.create({
            code: 'basic',
            name: 'Plan Básico (test)',
            priceDop: 1000,
            invoicesPerMonth: 200,
            maxUsers: 2,
            maxSequences: 2
        });
    }
    planId = plan.id;

    const company = await Company.create({
        rnc: TEST_RNC,
        name: 'Test Subscription Lifecycle SRL',
        dgiiEnvironment: 'testecf'
    });
    companyId = company.id;
}

// ------------------------------------------------------------
// Helper para crear una sub con estado y fechas específicas.
// Auto-corrige startsAt si trialEndsAt <= startsAt, y
// currentPeriodStart si currentPeriodEnd <= currentPeriodStart,
// para respetar las validaciones cross-field del modelo.
// ------------------------------------------------------------
async function createSub(overrides = {}) {
    const base = {
        companyId,
        planId,
        status: 'trial',
        startsAt: daysAgo(60),
        trialEndsAt: daysFromNow(10),
        currentPeriodStart: daysAgo(60),
        currentPeriodEnd: daysFromNow(10),
        invoicesUsedThisMonth: 0
    };

    const data = { ...base, ...overrides };

    // Validación del modelo: trial_ends_at > starts_at
    if (data.trialEndsAt && data.startsAt && data.trialEndsAt <= data.startsAt) {
        data.startsAt = new Date(data.trialEndsAt.getTime() - 24 * 60 * 60 * 1000);
    }

    // Validación del modelo: ends_at > starts_at (si aplica)
    if (data.endsAt && data.startsAt && data.endsAt <= data.startsAt) {
        data.endsAt = new Date(data.startsAt.getTime() + 24 * 60 * 60 * 1000);
    }

    return Subscription.create(data);
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await setup();
        console.log('✅ Setup completed\n');

        // ====================================================
        // TEST 1: trial → past_due
        // ====================================================
        console.log('--- Test 1: trial → past_due ---');
        const subTrial = await createSub({
            status: 'trial',
            trialEndsAt: daysAgo(1),
            currentPeriodEnd: daysAgo(1),
            invoicesUsedThisMonth: 42
        });

        let result = await runJob();
        test('job retorna affected >= 1', result.affected >= 1, `got ${result.affected}`);
        test('trialToPastDue = 1', result.trialToPastDue === 1, `got ${result.trialToPastDue}`);

        await subTrial.reload();
        test('subTrial.status = past_due', subTrial.status === 'past_due', `got ${subTrial.status}`);
        test('subTrial.invoicesUsedThisMonth NO cambió (42)', Number(subTrial.invoicesUsedThisMonth) === 42, `got ${subTrial.invoicesUsedThisMonth}`);

        // ====================================================
        // TEST 2: past_due → expired (vino de trial)
        // ====================================================
        console.log('\n--- Test 2: past_due → expired (trial + 3d) ---');
        const subExpired = await createSub({
            status: 'past_due',
            trialEndsAt: daysAgo(5),
            currentPeriodEnd: daysAgo(5),
            invoicesUsedThisMonth: 10
        });

        result = await runJob();
        test('pastDueToExpired >= 1', result.pastDueToExpired >= 1, `got ${result.pastDueToExpired}`);

        await subExpired.reload();
        test('subExpired.status = expired', subExpired.status === 'expired', `got ${subExpired.status}`);
        test('subExpired.invoicesUsedThisMonth NO cambió (10)', Number(subExpired.invoicesUsedThisMonth) === 10, `got ${subExpired.invoicesUsedThisMonth}`);

        // ====================================================
        // TEST 3: active → past_due
        // ====================================================
        console.log('\n--- Test 3: active → past_due ---');
        const subActive = await createSub({
            status: 'active',
            trialEndsAt: null,
            currentPeriodEnd: daysAgo(1),
            invoicesUsedThisMonth: 7
        });

        result = await runJob();
        test('activeToPastDue >= 1', result.activeToPastDue >= 1, `got ${result.activeToPastDue}`);

        await subActive.reload();
        test('subActive.status = past_due', subActive.status === 'past_due', `got ${subActive.status}`);
        test('subActive.invoicesUsedThisMonth NO cambió (7)', Number(subActive.invoicesUsedThisMonth) === 7, `got ${subActive.invoicesUsedThisMonth}`);

        // ====================================================
        // TEST 4: dentro de gracia (past_due con 2 días)
        // ====================================================
        console.log('\n--- Test 4: past_due dentro de gracia (2d) ---');
        const subGrace = await createSub({
            status: 'past_due',
            trialEndsAt: daysAgo(2),
            currentPeriodEnd: daysAgo(2),
            invoicesUsedThisMonth: 3
        });

        result = await runJob();
        await subGrace.reload();
        test('subGrace sigue past_due (dentro de gracia)', subGrace.status === 'past_due', `got ${subGrace.status}`);

        // ====================================================
        // TEST 5: sub vigente NO se toca
        // ====================================================
        console.log('\n--- Test 5: sub vigente no se toca ---');
        const subVigente = await createSub({
            status: 'active',
            trialEndsAt: null,
            currentPeriodEnd: daysFromNow(15),
            invoicesUsedThisMonth: 5
        });

        result = await runJob();
        await subVigente.reload();
        test('subVigente sigue active', subVigente.status === 'active', `got ${subVigente.status}`);
        test('subVigente.invoicesUsedThisMonth NO cambió (5)', Number(subVigente.invoicesUsedThisMonth) === 5);

        // ====================================================
        // TEST 6: cancelled NO se toca
        // ====================================================
        console.log('\n--- Test 6: cancelled no se toca ---');
        const subCancelled = await createSub({
            status: 'cancelled',
            trialEndsAt: daysAgo(30),
            currentPeriodEnd: daysAgo(30),
            invoicesUsedThisMonth: 0
        });

        result = await runJob();
        await subCancelled.reload();
        test('subCancelled sigue cancelled', subCancelled.status === 'cancelled', `got ${subCancelled.status}`);

        // ====================================================
        // TEST 7: audit log insertado
        // ====================================================
        console.log('\n--- Test 7: audit log ---');
        const auditCount = await AuditLog.count({
            where: { action: 'job.subscription-lifecycle' }
        });
        test('audit_log job.subscription-lifecycle insertado', auditCount >= 1, `got ${auditCount}`);

        // ====================================================
        // TEST 8: idempotencia (segunda corrida sin cambios)
        // ====================================================
        console.log('\n--- Test 8: idempotencia ---');
        result = await runJob();
        test('segunda corrida affected = 0', result.affected === 0, `got ${result.affected}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            await cleanup();
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        await sequelize.close();
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();