// ============================================================
// Test de integración: poll-pending-status.job
//
// Verifica:
//   1. Sin dgii.status → stub path (affected 0)
//   2. Con mock → factura pending NO cambia status
//   3. Con mock → factura accepted → status='accepted'
//   4. Con mock → factura rejected → status='rejected'
//   5. Facturas recientes (< 5 min) NO se consultan
//   6. Facturas sin track_id NO se consultan
//   7. Facturas que no están 'sent' NO se consultan
//   8. Error de red → se cuenta como error, no cambia status
//
// Uso:
//   node test/integration/poll-pending-status.test.js
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const Module = require('module');
const sequelize = require('../../src/config/database');
const {
    Company, Plan, Subscription, Sequence, Invoice, User, AuditLog
} = require('../../src/models');

const TEST_RNC = '130999991';

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
                { action: { [Op.like]: 'job.poll-pending-status%' } }
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
        name: 'Test Poll Status SRL',
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
    return `E3100001${String(ncfCounter).padStart(5, '0')}`;
}

async function createInvoice(overrides = {}) {
    return Invoice.create({
        companyId,
        sequenceId,
        type: '31',
        ncf: nextNcf(),
        status: 'sent',
        issuerRnc: TEST_RNC,
        issuerName: 'Test Poll Status SRL',
        subtotal: 1000,
        itbis: 180,
        total: 1180,
        issuedAt: new Date(),
        sendAttempts: 1,
        trackId: 'TRK-DEFAULT',
        ...overrides
    });
}

// ------------------------------------------------------------
// Mock de dgii.status via Module._load
// ------------------------------------------------------------
let _originalLoad = null;

function installMockStatus(checkStatusImpl) {
    const original = Module._load;
    Module._load = function (request, parent, isMain) {
        if (
            request.endsWith('dgii.status') ||
            request.includes('dgii/dgii.status') ||
            request.includes('dgii\\dgii.status')
        ) {
            return { checkStatus: checkStatusImpl };
        }
        return original.apply(this, arguments);
    };
    _originalLoad = original;
}

function uninstallMockStatus() {
    if (_originalLoad) {
        Module._load = _originalLoad;
        _originalLoad = null;
    }
}

function reloadJob() {
    const jobPath = require.resolve('../../src/modules/jobs/jobs/poll-pending-status.job');
    delete require.cache[jobPath];
    return require('../../src/modules/jobs/jobs/poll-pending-status.job')._raw;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await setup();
        console.log('✅ Setup completed\n');

        // ====================================================
        // TEST 1: sin dgii.status → stub
        // ====================================================
        console.log('--- Test 1: sin dgii.status (stub) ---');
        await purgeInvoices();
        await createInvoice({ createdAt: minutesAgo(10) });

        let runJob = reloadJob();
        let result = await runJob();
        test('affected = 0 (stub)', result.affected === 0, `got ${result.affected}`);
        test('reason = dgii.status not implemented', result.reason === 'dgii.status not implemented');

        // ====================================================
        // TEST 2: mock → pending
        // ====================================================
        console.log('\n--- Test 2: mock pending ---');
        installMockStatus(async () => ({ estado: 'pendiente' }));

        await purgeInvoices();
        const invPending = await createInvoice({ createdAt: minutesAgo(10), trackId: 'TRK-PEND' });
        runJob = reloadJob();
        result = await runJob();
        await invPending.reload();
        test('status sigue sent', invPending.status === 'sent', `got ${invPending.status}`);
        test('pending = 1', result.pending === 1, `got ${result.pending}`);
        test('dgii_response guardado', invPending.dgiiResponse && invPending.dgiiResponse.estado === 'pendiente');

        // ====================================================
        // TEST 3: mock → accepted
        // ====================================================
        console.log('\n--- Test 3: mock accepted ---');
        uninstallMockStatus();
        installMockStatus(async () => ({ estado: 'Aceptado', trackId: 'TRK-OK' }));

        await purgeInvoices();
        const invAccepted = await createInvoice({ createdAt: minutesAgo(10), trackId: 'TRK-OK' });
        runJob = reloadJob();
        result = await runJob();
        await invAccepted.reload();
        test('status = accepted', invAccepted.status === 'accepted', `got ${invAccepted.status}`);
        test('accepted = 1', result.accepted === 1, `got ${result.accepted}`);
        test('dgii_response guardado', invAccepted.dgiiResponse?.estado === 'Aceptado');

        // ====================================================
        // TEST 4: mock → rejected
        // ====================================================
        console.log('\n--- Test 4: mock rejected ---');
        uninstallMockStatus();
        installMockStatus(async () => ({ estado: 'Rechazado', motivo: 'RNC inválido' }));

        await purgeInvoices();
        const invRejected = await createInvoice({ createdAt: minutesAgo(10), trackId: 'TRK-BAD' });
        runJob = reloadJob();
        result = await runJob();
        await invRejected.reload();
        test('status = rejected', invRejected.status === 'rejected', `got ${invRejected.status}`);
        test('rejected = 1', result.rejected === 1, `got ${result.rejected}`);
        test('dgii_response guardado con motivo', invRejected.dgiiResponse?.motivo === 'RNC inválido');

        // ====================================================
        // TEST 5: factura reciente NO se consulta
        // ====================================================
        console.log('\n--- Test 5: factura reciente no se consulta ---');
        await purgeInvoices();
        const invRecent = await createInvoice({ createdAt: minutesAgo(2), trackId: 'TRK-RECENT' });
        result = await runJob();
        await invRecent.reload();
        test('invRecent sigue sent', invRecent.status === 'sent');
        test('affected = 0', result.affected === 0, `got ${result.affected}`);

        // ====================================================
        // TEST 6: factura sin track_id NO se consulta
        // ====================================================
        console.log('\n--- Test 6: sin track_id no se consulta ---');
        await purgeInvoices();
        const invNoTrack = await createInvoice({ createdAt: minutesAgo(10), trackId: null });
        result = await runJob();
        await invNoTrack.reload();
        test('invNoTrack sigue sent', invNoTrack.status === 'sent');
        test('affected = 0', result.affected === 0, `got ${result.affected}`);

        // ====================================================
        // TEST 7: factura no-'sent' NO se consulta
        // ====================================================
        console.log('\n--- Test 7: factura no-sent no se consulta ---');
        await purgeInvoices();
        const invAccepted2 = await createInvoice({
            createdAt: minutesAgo(10),
            trackId: 'TRK-ACC',
            status: 'accepted'
        });
        result = await runJob();
        await invAccepted2.reload();
        test('invAccepted2 sigue accepted', invAccepted2.status === 'accepted');
        test('affected = 0', result.affected === 0, `got ${result.affected}`);

        // ====================================================
        // TEST 8: error de red no cambia status
        // ====================================================
        console.log('\n--- Test 8: error de red no cambia status ---');
        uninstallMockStatus();
        installMockStatus(async () => { throw new Error('DGII unavailable'); });

        await purgeInvoices();
        const invNetErr = await createInvoice({ createdAt: minutesAgo(10), trackId: 'TRK-NETERR' });
        runJob = reloadJob();
        result = await runJob();
        await invNetErr.reload();
        test('invNetErr sigue sent', invNetErr.status === 'sent', `got ${invNetErr.status}`);
        test('errors = 1', result.errors === 1, `got ${result.errors}`);

        uninstallMockStatus();

        // ====================================================
        // TEST 9: audit log
        // ====================================================
        console.log('\n--- Test 9: audit log ---');
        const auditCount = await AuditLog.count({
            where: { action: 'job.poll-pending-status' }
        });
        test('audit_log insertado', auditCount >= 1, `got ${auditCount}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        uninstallMockStatus();
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