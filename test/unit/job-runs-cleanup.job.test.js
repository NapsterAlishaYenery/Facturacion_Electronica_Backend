// ============================================================
// Test unitario: job-runs-cleanup.job
//
// Verifica:
//   1. getRetentionDays() lee env con default 30
//   2. getRetentionDays() respeta valores válidos
//   3. getRetentionDays() cae al default con valores inválidos
//   4. _raw() hace skip si retentionDays <= 0 (sin tocar BD)
//   5. _raw() NO toca BD si retention = 0
//
// NO toca BD: usa retention=0 para que el job haga skip
// antes de cualquier query.
//
// Uso:
//   node test/unit/job-runs-cleanup.job.test.js
// ============================================================

require('dotenv').config();
process.env.NODE_ENV = 'test';

const assert = require('assert');
const cleanupJob = require('../../src/modules/jobs/jobs/job-runs-cleanup.job');

let passed = 0;
let failed = 0;

function test(label, fn) {
    try {
        fn();
        console.log(`  ✅ ${label}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${label}`);
        console.log(`     ${err.message}`);
        failed++;
    }
}

async function testAsync(label, fn) {
    try {
        await fn();
        console.log(`  ✅ ${label}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${label}`);
        console.log(`     ${err.message}`);
        failed++;
    }
}

(async () => {

    console.log('\n=== TESTS: job-runs-cleanup.job (unit) ===\n');

    // --------------------------------------------------------
    // Test 1: getRetentionDays()
    // --------------------------------------------------------
    console.log('--- getRetentionDays ---');

    const originalEnv = process.env.JOB_RUNS_RETENTION_DAYS;

    test('default 30 si env no está definido', () => {
        delete process.env.JOB_RUNS_RETENTION_DAYS;
        assert.strictEqual(cleanupJob.getRetentionDays(), 30);
    });

    test('respeta valor válido (15)', () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '15';
        assert.strictEqual(cleanupJob.getRetentionDays(), 15);
    });

    test('respeta valor válido (0)', () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '0';
        assert.strictEqual(cleanupJob.getRetentionDays(), 0);
    });

    test('respeta valor negativo (-5)', () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '-5';
        assert.strictEqual(cleanupJob.getRetentionDays(), -5);
    });

    test('cae al default con string no numérico', () => {
        process.env.JOB_RUNS_RETENTION_DAYS = 'abc';
        assert.strictEqual(cleanupJob.getRetentionDays(), 30);
    });

    test('cae al default con string vacío', () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '';
        assert.strictEqual(cleanupJob.getRetentionDays(), 30);
    });

    // --------------------------------------------------------
    // Test 2: _raw() hace skip si retención <= 0
    // --------------------------------------------------------
    console.log('\n--- _raw() skip con retención deshabilitada ---');

    await testAsync('retention=0 → affected 0, reason "retention disabled"', async () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '0';
        const result = await cleanupJob._raw();
        assert.strictEqual(result.affected, 0);
        assert.strictEqual(result.entity, 'job_run');
        assert.strictEqual(result.reason, 'retention disabled');
        assert.strictEqual(result.retentionDays, 0);
    });

    await testAsync('retention=-1 → también skip', async () => {
        process.env.JOB_RUNS_RETENTION_DAYS = '-1';
        const result = await cleanupJob._raw();
        assert.strictEqual(result.affected, 0);
        assert.strictEqual(result.reason, 'retention disabled');
    });

    // Restaurar env
    if (originalEnv === undefined) {
        delete process.env.JOB_RUNS_RETENTION_DAYS;
    } else {
        process.env.JOB_RUNS_RETENTION_DAYS = originalEnv;
    }

    // --------------------------------------------------------
    // Resultado
    // --------------------------------------------------------
    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);

})();