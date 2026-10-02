// ============================================================
// Test de integración: retry-failed-sends.job
//
// Verifica:
//   1. Sin dgii.sender → job retorna affected 0 (stub path)
//   2. Con dgii.sender mock → procesa facturas
//   3. Factura enviada OK → status='sent', track_id seteado
//   4. Factura con error → send_attempts++ pero status sigue signed
//   5. Factura con 5 intentos fallidos → status='rejected'
//   6. Facturas recientes (< 30 min) NO se tocan
//   7. Facturas con track_id NO se tocan
//
// Uso:
//   node test/integration/retry-failed-sends.test.js
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const path = require('path');
const Module = require('module');
const sequelize = require('../../src/config/database');
const {
    Company, Plan, Subscription, Sequence, Invoice, User, AuditLog
} = require('../../src/models');

const TEST_RNC = '130999990';
const TEST_EMAIL = 'owner-retrysends@expedinap.com';

let companyId = null;
let sequenceId = null;
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

function minutesAgo(n) {
    return new Date(Date.now() - n * 60 * 1000);
}

function daysFromNow(n) {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function cleanup() {
    const old = await Company.findOne({ where: { rnc: TEST_RNC } });
    if (!old) return;

    const invoices = await Invoice.findAll({ where: { companyId: old.id }, attributes: ['id'] });
    const invIds = invoices.map(i => i.id);

    await AuditLog.destroy({
        where: {
            [Op.or]: [
                { companyId: old.id },
                { action: { [Op.like]: 'job.retry-failed-sends%' } }
            ]
        }
    });

    await Invoice.destroy({ where: { companyId: old.id } });
    await Sequence.destroy({ where: { companyId: old.id } });
    await Subscription.destroy({ where: { companyId: old.id } });
    await User.destroy({ where: { companyId: old.id } });
    await Company.destroy({ where: { id: old.id } });
}

async function setup() {
    await cleanup();

    let plan = await Plan.findOne({ where: { code: 'basic' } });
    if (!plan) {
        plan = await Plan.create({
            code: 'basic', name: 'Plan Básico (test)',
            priceDop: 1000, invoicesPerMonth: 200, maxUsers: 2, maxSequences: 2
        });
    }
    planId = plan.id;

    const company = await Company.create({
        rnc: TEST_RNC,
        name: 'Test Retry Sends SRL',
        dgiiEnvironment: 'testecf'
    });
    companyId = company.id;

    const seq = await Sequence.create({
        companyId,
        type: '31',
        prefix: 'E',
        startNumber: 1,
        endNumber: 100,
        currentNumber: 0,
        expiresAt: daysFromNow(365),
        isActive: true
    });
    sequenceId = seq.id;
}

let ncfCounter = 0;
function nextNcf() {
    ncfCounter++;
    return `E3100000${String(ncfCounter).padStart(5, '0')}`;
}

async function createInvoice(overrides = {}) {
    return Invoice.create({
        companyId,
        sequenceId,
        type: '31',
        ncf: nextNcf(),
        status: 'signed',
        issuerRnc: TEST_RNC,
        issuerName: 'Test Retry Sends SRL',
        subtotal: 1000,
        itbis: 180,
        total: 1180,
        issuedAt: new Date(),
        sendAttempts: 0,
        trackId: null,
        ...overrides
    });
}

// ------------------------------------------------------------
// Inyecta un mock de dgii.sender antes de requerir el job
// ------------------------------------------------------------
function installMockSender(sendECFImpl) {
    const dgiiPath = require.resolve('../../src/modules/dgii/dgii.sender');
    const original = Module._cache[dgiiPath];
    Module._cache[dgiiPath] = {
        id: dgiiPath,
        filename: dgiiPath,
        loaded: true,
        exports: { sendECF: sendECFImpl }
    };
    return original;
}

function uninstallMockSender(original) {
    const dgiiPath = require.resolve('../../src/modules/dgii/dgii.sender');
    if (original) Module._cache[dgiiPath] = original;
    else delete Module._cache[dgiiPath];
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await setup();
        console.log('✅ Setup completed\n');

        // ====================================================
        // TEST 1: sin dgii.sender → stub path
        // ====================================================
        console.log('--- Test 1: sin dgii.sender (stub) ---');
        delete require.cache[require.resolve('../../src/modules/jobs/jobs/retry-failed-sends.job')];
        let job = require('../../src/modules/jobs/jobs/retry-failed-sends.job');
        let runJob = job._raw;

        const invStub = await createInvoice({ createdAt: minutesAgo(60) });
        let result = await runJob();
        test('affected = 0 (stub)', result.affected === 0, `got ${result.affected}`);
        test('reason = dgii.sender not implemented', result.reason === 'dgii.sender not implemented');

        await invStub.reload();
        test('invStub sigue signed', invStub.status === 'signed');
        test('invStub.sendAttempts NO cambió (0)', invStub.sendAttempts === 0);

        // ====================================================
        // TEST 2: con mock sender — factura enviada OK
        // ====================================================
        console.log('\n--- Test 2: mock sender OK ---');
        const original = installMockSender(async () => ({ trackId: 'TRK-OK-001' }));

        delete require.cache[require.resolve('../../src/modules/jobs/jobs/retry-failed-sends.job')];
        job = require('../../src/modules/jobs/jobs/retry-failed-sends.job');
        runJob = job._raw;

        const invOk = await createInvoice({ createdAt: minutesAgo(60) });
        result = await runJob();
        test('affected >= 1', result.affected >= 1, `got ${result.affected}`);
        test('sent = 1', result.sent === 1, `got ${result.sent}`);

        await invOk.reload();
        test('invOk.status = sent', invOk.status === 'sent', `got ${invOk.status}`);
        test('invOk.trackId = TRK-OK-001', invOk.trackId === 'TRK-OK-001', `got ${invOk.trackId}`);
        test('invOk.sendAttempts = 1', invOk.sendAttempts === 1);

        // ====================================================
        // TEST 3: mock sender — error sin superar max
        // ====================================================
        console.log('\n--- Test 3: mock sender con error (< max) ---');
        uninstallMockSender(original);
        const orig2 = installMockSender(async () => { throw new Error('DGII timeout'); });

        delete require.cache[require.resolve('../../src/modules/jobs/jobs/retry-failed-sends.job')];
        job = require('../../src/modules/jobs/jobs/retry-failed-sends.job');
        runJob = job._raw;

        const invErr = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 2 });
        result = await runJob();
        await invErr.reload();
        test('invErr.status sigue signed', invErr.status === 'signed', `got ${invErr.status}`);
        test('invErr.sendAttempts = 3', invErr.sendAttempts === 3, `got ${invErr.sendAttempts}`);

        // ====================================================
        // TEST 4: mock sender — 5to intento → rejected
        // ====================================================
        console.log('\n--- Test 4: 5to intento fallido → rejected ---');
        const invExhausted = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 4 });
        result = await runJob();
        await invExhausted.reload();
        test('invExhausted.status = rejected', invExhausted.status === 'rejected', `got ${invExhausted.status}`);
        test('invExhausted.sendAttempts = 5', invExhausted.sendAttempts === 5);

        // ====================================================
        // TEST 5: factura reciente NO se toca
        // ====================================================
        console.log('\n--- Test 5: factura reciente no se toca ---');
        const invRecent = await createInvoice({ createdAt: minutesAgo(5) });
        result = await runJob();
        await invRecent.reload();
        test('invRecent sigue signed', invRecent.status === 'signed');
        test('invRecent.sendAttempts = 0', invRecent.sendAttempts === 0);

        // ====================================================
        // TEST 6: factura con track_id NO se toca
        // ====================================================
        console.log('\n--- Test 6: factura con track_id no se toca ---');
        const invWithTrack = await createInvoice({
            createdAt: minutesAgo(60),
            status: 'sent',
            trackId: 'TRK-ALREADY'
        });
        result = await runJob();
        await invWithTrack.reload();
        test('invWithTrack sigue sent', invWithTrack.status === 'sent');
        test('invWithTrack.sendAttempts = 0', invWithTrack.sendAttempts === 0);

        // ====================================================
        // TEST 7: factura con send_attempts >= 5 NO se toca
        // ====================================================
        console.log('\n--- Test 7: send_attempts >= 5 no se toca ---');
        const invMax = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 5 });
        result = await runJob();
        await invMax.reload();
        test('invMax sigue signed (no reintentado)', invMax.status === 'signed');
        test('invMax.sendAttempts = 5', invMax.sendAttempts === 5);

        uninstallMockSender(orig2);

        // ====================================================
        // TEST 8: audit log
        // ====================================================
        console.log('\n--- Test 8: audit log ---');
        const auditCount = await AuditLog.count({
            where: { action: 'job.retry-failed-sends' }
        });
        test('audit_log insertado', auditCount >= 1, `got ${auditCount}`);

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