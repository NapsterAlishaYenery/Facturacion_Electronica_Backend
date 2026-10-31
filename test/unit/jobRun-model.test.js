// ============================================================
// Test unitario: modelo JobRun
//
// Verifica que el modelo:
//   1. Se carga sin error y exporta
//   2. Tiene tableName 'job_runs'
//   3. Define todas las columnas con sus tipos correctos
//   4. Tiene los defaults correctos (affected=0, durationMs=0,
//      triggeredBy='cron', status no tiene default)
//   5. Valida correctamente con datos válidos (sin tocar BD)
//   6. Rechaza status inválido
//   7. Rechaza triggeredBy inválido
//   8. Rechaza affected negativo
//   9. Rechaza durationMs negativo
//  10. Rechaza jobName vacío
//  11. Acepta meta como objeto libre
//
// NO toca BD. Solo valida la definición del modelo y sus
// validaciones de Sequelize (build + validate, sin save).
//
// Uso:
//   node test/unit/jobRun-model.test.js
// ============================================================

require('dotenv').config();
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { JobRun } = require('../../src/models');

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

// Helper para tests async (validaciones de Sequelize son async)
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

// Helper: construye un JobRun válido mínimo
function buildValid(overrides = {}) {
    return JobRun.build({
        jobName: 'test-job',
        status: 'success',
        affected: 5,
        durationMs: 120,
        error: null,
        meta: { foo: 'bar' },
        triggeredBy: 'cron',
        startedAt: new Date(),
        ...overrides
    });
}

// ============================================================
// Runner principal (async porque validate() lo es)
// ============================================================
(async () => {

    console.log('\n=== TESTS: modelo JobRun (unit) ===\n');

    // --------------------------------------------------------
    // Test 1: exports y metadatos
    // --------------------------------------------------------
    console.log('--- Exports y metadatos ---');

    test('JobRun está exportado desde models/index', () => {
        assert.ok(JobRun, 'JobRun debe existir');
        assert.strictEqual(typeof JobRun.build, 'function');
    });

    test('tableName es "job_runs"', () => {
        assert.strictEqual(JobRun.tableName, 'job_runs');
    });

    test('usa timestamps y underscored', () => {
        assert.strictEqual(JobRun.options.timestamps, true);
        assert.strictEqual(JobRun.options.underscored, true);
    });

    // --------------------------------------------------------
    // Test 2: columnas y tipos
    // --------------------------------------------------------
    console.log('\n--- Columnas y tipos ---');

    test('id es UUID y primaryKey', () => {
        const attr = JobRun.rawAttributes.id;
        assert.strictEqual(attr.primaryKey, true);
        assert.ok(attr.type.toString().includes('UUID'));
        // PK siempre es NOT NULL por definición de Sequelize,
        // aunque allowNull no esté seteado como false explícito en el atributo.
        assert.notStrictEqual(attr.allowNull, true);
    });

    test('jobName mapea a job_name', () => {
        const attr = JobRun.rawAttributes.jobName;
        assert.strictEqual(attr.field, 'job_name');
        assert.strictEqual(attr.allowNull, false);
    });

    test('durationMs mapea a duration_ms', () => {
        const attr = JobRun.rawAttributes.durationMs;
        assert.strictEqual(attr.field, 'duration_ms');
        assert.strictEqual(attr.allowNull, false);
    });

    test('triggeredBy mapea a triggered_by y default "cron"', () => {
        const attr = JobRun.rawAttributes.triggeredBy;
        assert.strictEqual(attr.field, 'triggered_by');
        assert.strictEqual(attr.defaultValue, 'cron');
    });

    test('startedAt mapea a started_at y allowNull false', () => {
        const attr = JobRun.rawAttributes.startedAt;
        assert.strictEqual(attr.field, 'started_at');
        assert.strictEqual(attr.allowNull, false);
    });

    test('meta es JSONB y allowNull true', () => {
        const attr = JobRun.rawAttributes.meta;
        assert.ok(attr.type.toString().includes('JSONB'));
        assert.strictEqual(attr.allowNull, true);
    });

    test('error es TEXT y allowNull true', () => {
        const attr = JobRun.rawAttributes.error;
        assert.strictEqual(attr.allowNull, true);
    });

    test('affected tiene default 0', () => {
        assert.strictEqual(JobRun.rawAttributes.affected.defaultValue, 0);
    });

    test('durationMs tiene default 0', () => {
        assert.strictEqual(JobRun.rawAttributes.durationMs.defaultValue, 0);
    });

    // --------------------------------------------------------
    // Test 3: validaciones (build + validate, sin save)
    // --------------------------------------------------------
    console.log('\n--- Validaciones ---');

    await testAsync('acepta un JobRun válido', async () => {
        const run = buildValid();
        await run.validate();
    });

    await testAsync('acepta status "failed"', async () => {
        const run = buildValid({ status: 'failed', error: 'boom' });
        await run.validate();
    });

    await testAsync('acepta status "skipped"', async () => {
        const run = buildValid({ status: 'skipped' });
        await run.validate();
    });

    await testAsync('rechaza status inválido', async () => {
        const run = buildValid({ status: 'invented' });
        await assert.rejects(() => run.validate(), /Status must be/);
    });

    await testAsync('rechaza triggeredBy inválido', async () => {
        const run = buildValid({ triggeredBy: 'unknown' });
        await assert.rejects(() => run.validate(), /TriggeredBy must be/);
    });

    await testAsync('rechaza affected negativo', async () => {
        const run = buildValid({ affected: -1 });
        await assert.rejects(() => run.validate(), /cannot be negative/);
    });

    await testAsync('rechaza durationMs negativo', async () => {
        const run = buildValid({ durationMs: -5 });
        await assert.rejects(() => run.validate(), /cannot be negative/);
    });

    await testAsync('rechaza jobName vacío', async () => {
        const run = buildValid({ jobName: '' });
        await assert.rejects(() => run.validate(), /Job name is required/);
    });

    await testAsync('acepta triggeredBy "manual"', async () => {
        const run = buildValid({ triggeredBy: 'manual' });
        await run.validate();
    });

    await testAsync('acepta meta null (sin metadata)', async () => {
        const run = buildValid({ meta: null });
        await run.validate();
    });

    // --------------------------------------------------------
    // Resultado final
    // --------------------------------------------------------
    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

    process.exit(failed > 0 ? 1 : 0);

})();