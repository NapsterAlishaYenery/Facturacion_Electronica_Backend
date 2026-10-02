// ============================================================
// Test de integración: check-expiring-sequences.job
//
// Verifica que el job desactiva solo secuencias vencidas.
//
// Uso:
//   node test/integration/check-expiring-sequences.test.js
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company, Plan, Subscription, Sequence, User, AuditLog
} = require('../../src/models');

const job = require('../../src/modules/jobs/jobs/check-expiring-sequences.job');
const runJob = job._raw;

const TEST_RNC = '130999978';

let companyId = null;
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

async function cleanup() {
    const old = await Company.findOne({ where: { rnc: TEST_RNC } });
    if (!old) return;

    await AuditLog.destroy({
        where: {
            [Op.or]: [
                { companyId: old.id },
                { action: { [Op.like]: 'job.check-expiring-sequences%' } }
            ]
        }
    });
    await Sequence.destroy({ where: { companyId: old.id } });
    await Subscription.destroy({ where: { companyId: old.id } });
    await User.destroy({ where: { companyId: old.id } });
    await Company.destroy({ where: { id: old.id } });
}

async function setup() {
    await cleanup();

    const company = await Company.create({
        rnc: TEST_RNC,
        name: 'Test Expiring Sequences SRL',
        dgiiEnvironment: 'testecf'
    });
    companyId = company.id;
}

async function createSeq(overrides = {}) {
    return Sequence.create({
        companyId,
        type: '31',
        prefix: 'E',
        startNumber: 1,
        endNumber: 100,
        currentNumber: 0,
        expiresAt: daysFromNow(30),
        isActive: true,
        ...overrides
    });
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await setup();
        console.log('✅ Setup completed\n');

        // ----------------------------------------------------
        // TEST 1: secuencia vencida se desactiva
        // ----------------------------------------------------
        console.log('--- Test 1: secuencia vencida se desactiva ---');
        const seqExpired = await createSeq({
            expiresAt: daysAgo(1),
            isActive: true
        });

        let result = await runJob();
        test('affected >= 1', result.affected >= 1, `got ${result.affected}`);

        await seqExpired.reload();
        test('seqExpired.isActive = false', seqExpired.isActive === false, `got ${seqExpired.isActive}`);

        // ----------------------------------------------------
        // TEST 2: secuencia vigente NO se toca
        // ----------------------------------------------------
        console.log('\n--- Test 2: secuencia vigente no se toca ---');
        const seqVigente = await createSeq({
            expiresAt: daysFromNow(30),
            isActive: true
        });

        result = await runJob();
        await seqVigente.reload();
        test('seqVigente sigue isActive = true', seqVigente.isActive === true, `got ${seqVigente.isActive}`);

        // ----------------------------------------------------
        // TEST 3: secuencia ya inactiva NO se toca
        // ----------------------------------------------------
        console.log('\n--- Test 3: secuencia ya inactiva no se toca ---');
        const seqInactive = await createSeq({
            expiresAt: daysAgo(10),
            isActive: false
        });

        result = await runJob();
        await seqInactive.reload();
        test('seqInactive sigue isActive = false', seqInactive.isActive === false);

        // ----------------------------------------------------
        // TEST 4: audit log insertado
        // ----------------------------------------------------
        console.log('\n--- Test 4: audit log ---');
        const auditCount = await AuditLog.count({
            where: { action: 'job.check-expiring-sequences' }
        });
        test('audit_log insertado', auditCount >= 1, `got ${auditCount}`);

        // ----------------------------------------------------
        // TEST 5: idempotencia
        // ----------------------------------------------------
        console.log('\n--- Test 5: idempotencia ---');
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