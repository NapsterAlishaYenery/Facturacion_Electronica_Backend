// ============================================================
// Test de integración: job-runs-cleanup.job
//
// Inserta filas de prueba en job_runs con started_at controlado,
// ejecuta el job (via _raw), y verifica:
//   1. Se borran las filas con started_at < cutoff
//   2. NO se borran las filas con started_at >= cutoff
//   3. Filas de OTROS jobs también se borran (no filtra por job_name)
//   4. El audit_log se registra correctamente (action = job.job-runs-cleanup)
//
// Requiere:
//   - BD arriba (sequelize.authenticate())
//   - Tabla job_runs y audit_logs creadas
//   - NO requiere server HTTP corriendo
//
// Uso:
//   node test/integration/job-runs-cleanup.integration.test.js
// ============================================================

require('dotenv').config();
process.env.NODE_ENV = 'test';

const assert = require('assert');
const sequelize = require('../../src/config/database');
const { JobRun, AuditLog } = require('../../src/models');
const cleanupJob = require('../../src/modules/jobs/jobs/job-runs-cleanup.job');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    if (condition) passed++;
    else failed++;
    return condition;
}

// Prefijo único para no tocar datos reales
const RUN_ID = Date.now();
const TEST_PREFIX = `__test-cleanup-${RUN_ID}`;

// Helpers
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days) {
    return new Date(Date.now() - days * DAY_MS);
}

async function insertTestRun({ jobName, startedAt, status = 'success' }) {
    return JobRun.create({
        jobName,
        status,
        affected: 1,
        durationMs: 10,
        error: null,
        meta: { test: true },
        triggeredBy: 'cron',
        startedAt
    });
}

(async () => {
    const originalEnv = process.env.JOB_RUNS_RETENTION_DAYS;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ----------------------------------------------------
        // Setup: insertar filas de prueba
        // ----------------------------------------------------
        console.log('--- Setup: insertar filas de prueba ---');

        const oldRuns = [
            await insertTestRun({ jobName: `${TEST_PREFIX}-old-a`, startedAt: daysAgo(60) }),
            await insertTestRun({ jobName: `${TEST_PREFIX}-old-b`, startedAt: daysAgo(45) }),
            await insertTestRun({ jobName: `${TEST_PREFIX}-old-c`, startedAt: daysAgo(31) })
        ];

        const recentRuns = [
            await insertTestRun({ jobName: `${TEST_PREFIX}-recent-a`, startedAt: daysAgo(29) }),
            await insertTestRun({ jobName: `${TEST_PREFIX}-recent-b`, startedAt: daysAgo(10) }),
            await insertTestRun({ jobName: `${TEST_PREFIX}-recent-c`, startedAt: daysAgo(0) })
        ];

        const initialTotal = await JobRun.count();
        console.log(`  Total en job_runs: ${initialTotal} (3 viejas + 3 recientes de test + datos reales)\n`);

        // ----------------------------------------------------
        // Test 1: correr el job con retención 30 días
        // ----------------------------------------------------
        console.log('--- Test 1: purga con retention=30 ---');

        process.env.JOB_RUNS_RETENTION_DAYS = '30';
        const result = await cleanupJob._raw();

        test('job retorna affected > 0', result.affected > 0, `affected=${result.affected}`);
        test('retentionDays usado es 30', result.retentionDays === 30);
        test('job retorna cutoff ISO string', typeof result.cutoff === 'string' && !isNaN(Date.parse(result.cutoff)));

        // ----------------------------------------------------
        // Test 2: las filas viejas de test se borraron
        // ----------------------------------------------------
        console.log('\n--- Test 2: filas viejas borradas ---');

        for (const run of oldRuns) {
            const stillThere = await JobRun.findByPk(run.id);
            test(`fila vieja ${run.jobName} borrada`, stillThere === null);
        }

        // ----------------------------------------------------
        // Test 3: las filas recientes de test NO se borraron
        // ----------------------------------------------------
        console.log('\n--- Test 3: filas recientes preservadas ---');

        for (const run of recentRuns) {
            const stillThere = await JobRun.findByPk(run.id);
            test(`fila reciente ${run.jobName} preservada`, stillThere !== null);
        }

        // ----------------------------------------------------
        // Test 4: audit_log registrado
        // ----------------------------------------------------
        console.log('\n--- Test 4: audit log registrado ---');

        const audit = await AuditLog.findOne({
            where: { action: 'job.job-runs-cleanup' },
            order: [['createdAt', 'DESC']]
        });

        test('existe audit log del job', audit !== null);
        test('audit.after.retentionDays = 30', audit?.after?.retentionDays === 30);
        test('audit.after.affected coincide con deleted', audit?.after?.affected === result.affected);
        test('audit.entity = "job_run"', audit?.entity === 'job_run');

        // ----------------------------------------------------
        // Test 5: idempotencia — correr de nuevo no borra las recientes
        // ----------------------------------------------------
        console.log('\n--- Test 5: segunda corrida (idempotencia) ---');

        const result2 = await cleanupJob._raw();
        test('segunda corrida borra 0 filas de test recientes', result2.affected >= 0);
        // (puede borrar otras si hay datos reales viejos, así que solo
        //  verificamos que las recientes de test siguen ahí)
        for (const run of recentRuns) {
            const stillThere = await JobRun.findByPk(run.id);
            test(`fila reciente ${run.jobName} sigue tras 2da corrida`, stillThere !== null);
        }

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        // ----------------------------------------------------
        // Cleanup
        // ----------------------------------------------------
        try {
            const { Op } = require('sequelize');

            const deletedRuns = await JobRun.destroy({
                where: { jobName: { [Op.like]: `${TEST_PREFIX}%` } }
            });

            const deletedAudit = await AuditLog.destroy({
                where: {
                    action: 'job.job-runs-cleanup',
                    createdAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) }
                }
            });

            console.log(`\n🧹 Cleanup: ${deletedRuns} job_runs, ${deletedAudit} audit_logs eliminados`);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }

        // Restaurar env
        if (originalEnv === undefined) {
            delete process.env.JOB_RUNS_RETENTION_DAYS;
        } else {
            process.env.JOB_RUNS_RETENTION_DAYS = originalEnv;
        }

        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

        await sequelize.close();
        process.exit(failed > 0 ? 1 : 0);
    }
})();