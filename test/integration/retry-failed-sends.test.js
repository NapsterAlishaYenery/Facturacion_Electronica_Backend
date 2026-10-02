// ============================================================
// Test de integración: retry-failed-sends.job
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
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

async function purgeInvoices() {
    await Invoice.destroy({ where: { companyId } });
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

let _originalLoad = null;

function installMockSender(sendECFImpl) {
    const original = Module._load;
    Module._load = function (request, parent, isMain) {
        if (
            request.endsWith('dgii.sender') ||
            request.includes('dgii/dgii.sender') ||
            request.includes('dgii\\dgii.sender')
        ) {
            return { sendECF: sendECFImpl };
        }
        return original.apply(this, arguments);
    };
    _originalLoad = original;
}

function uninstallMockSender() {
    if (_originalLoad) {
        Module._load = _originalLoad;
        _originalLoad = null;
    }
}

function reloadJob() {
    const jobPath = require.resolve('../../src/modules/jobs/jobs/retry-failed-sends.job');
    delete require.cache[jobPath];
    return require('../../src/modules/jobs/jobs/retry-failed-sends.job')._raw;
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
        await purgeInvoices();
        const invStub = await createInvoice({ createdAt: minutesAgo(60) });

        let runJob = reloadJob();
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
        installMockSender(async () => ({ trackId: 'TRK-OK-001' }));

        await purgeInvoices();
        const invOk = await createInvoice({ createdAt: minutesAgo(60) });
        runJob = reloadJob();
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
        uninstallMockSender();
        installMockSender(async () => { throw new Error('DGII timeout'); });

        await purgeInvoices();
        const invErr = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 2 });
        runJob = reloadJob();
        result = await runJob();
        await invErr.reload();
        test('invErr.status sigue signed', invErr.status === 'signed', `got ${invErr.status}`);
        test('invErr.sendAttempts = 3', invErr.sendAttempts === 3, `got ${invErr.sendAttempts}`);

        // ====================================================
        // TEST 4: mock sender — 5to intento → rejected
        // ====================================================
        console.log('\n--- Test 4: 5to intento fallido → rejected ---');
        await purgeInvoices();
        const invExhausted = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 4 });
        result = await runJob();
        await invExhausted.reload();
        test('invExhausted.status = rejected', invExhausted.status === 'rejected', `got ${invExhausted.status}`);
        test('invExhausted.sendAttempts = 5', invExhausted.sendAttempts === 5);

        // ====================================================
        // TEST 5: factura reciente NO se toca
        // ====================================================
        console.log('\n--- Test 5: factura reciente no se toca ---');
        await purgeInvoices();
        const invRecent = await createInvoice({ createdAt: minutesAgo(5) });
        result = await runJob();
        await invRecent.reload();
        test('invRecent sigue signed', invRecent.status === 'signed');
        test('invRecent.sendAttempts = 0', invRecent.sendAttempts === 0);

        // ====================================================
        // TEST 6: factura con track_id NO se toca
        // ====================================================
        console.log('\n--- Test 6: factura con track_id no se toca ---');
        await purgeInvoices();
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
        await purgeInvoices();
        const invMax = await createInvoice({ createdAt: minutesAgo(60), sendAttempts: 5 });
        result = await runJob();
        await invMax.reload();
        test('invMax sigue signed (no reintentado)', invMax.status === 'signed');
        test('invMax.sendAttempts = 5', invMax.sendAttempts === 5);

        uninstallMockSender();

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
        uninstallMockSender();
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