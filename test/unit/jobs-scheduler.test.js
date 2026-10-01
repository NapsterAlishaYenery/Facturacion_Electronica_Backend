// ============================================================
// Smoke test: jobs.scheduler
//
// Verifica que el scheduler:
//   1. Se carga sin error
//   2. Exporta startScheduler, stopScheduler, getScheduledJobs
//   3. Con ENABLE_JOBS=false → { started: false, jobsCount: 0 }
//   4. Con ENABLE_JOBS=true  → { started: true,  jobsCount: 0 }
//      (0 porque todos los jobs están enabled=false en Step 5.1)
//   5. cron.validate rechaza expresiones inválidas
//   6. stopScheduler no explota cuando no hay jobs montados
//
// NO toca BD. NO arranca el server. Solo carga el módulo.
//
// Uso:
//   node test/unit/jobs-scheduler.test.js
// ============================================================

require('dotenv').config();

// ⚠️ Forzar NODE_ENV=test para logs limpios (opcional)
process.env.NODE_ENV = 'test';

const assert = require('assert');
const cron = require('node-cron');
const scheduler = require('../../src/modules/jobs/jobs.scheduler');

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

console.log('\n=== TESTS: jobs.scheduler (smoke) ===\n');

// ------------------------------------------------------------
// Test 1: el módulo exporta lo esperado
// ------------------------------------------------------------
console.log('--- Exports ---');

test('module carga sin error', () => {
    assert.ok(scheduler, 'scheduler debe existir');
});

test('exporta startScheduler como función', () => {
    assert.strictEqual(typeof scheduler.startScheduler, 'function');
});

test('exporta stopScheduler como función', () => {
    assert.strictEqual(typeof scheduler.stopScheduler, 'function');
});

test('exporta getScheduledJobs como función', () => {
    assert.strictEqual(typeof scheduler.getScheduledJobs, 'function');
});

// ------------------------------------------------------------
// Test 2: ENABLE_JOBS=false → no arranca nada
// ------------------------------------------------------------
console.log('\n--- ENABLE_JOBS=false ---');

test('startScheduler retorna { started: false, jobsCount: 0 }', () => {
    process.env.ENABLE_JOBS = 'false';
    const result = scheduler.startScheduler();
    assert.strictEqual(result.started, false);
    assert.strictEqual(result.jobsCount, 0);
});

test('getScheduledJobs retorna array vacío', () => {
    const jobs = scheduler.getScheduledJobs();
    assert.ok(Array.isArray(jobs));
    assert.strictEqual(jobs.length, 0);
});

// ------------------------------------------------------------
// Test 3: ENABLE_JOBS=true → arranca pero 0 jobs activos
// (todos los jobs individuales están enabled=false en Step 5.1)
// ------------------------------------------------------------
console.log('\n--- ENABLE_JOBS=true ---');

test('startScheduler retorna { started: true, jobsCount: 0 }', () => {
    process.env.ENABLE_JOBS = 'true';
    const result = scheduler.startScheduler();
    assert.strictEqual(result.started, true);
    assert.strictEqual(result.jobsCount, 0);
});

test('getScheduledJobs retorna array (vacío por ahora)', () => {
    const jobs = scheduler.getScheduledJobs();
    assert.ok(Array.isArray(jobs));
    assert.strictEqual(jobs.length, 0);
});

// ------------------------------------------------------------
// Test 4: stopScheduler no explota sin jobs montados
// ------------------------------------------------------------
console.log('\n--- stopScheduler ---');

test('stopScheduler retorna { stopped: true, jobsCount: 0 }', () => {
    const result = scheduler.stopScheduler();
    assert.strictEqual(result.stopped, true);
    assert.strictEqual(result.jobsCount, 0);
});

test('getScheduledJobs sigue vacío tras stop', () => {
    const jobs = scheduler.getScheduledJobs();
    assert.strictEqual(jobs.length, 0);
});

// ------------------------------------------------------------
// Test 5: node-cron valida expresiones correctamente
// (esto es sanity check de la librería, no de nuestro código)
// ------------------------------------------------------------
console.log('\n--- node-cron sanity ---');

test('cron.validate acepta "0 0 1 * *"', () => {
    assert.strictEqual(cron.validate('0 0 1 * *'), true);
});

test('cron.validate rechaza "invalid expression"', () => {
    assert.strictEqual(cron.validate('invalid expression'), false);
});

// ------------------------------------------------------------
// Test 6: restaurar ENABLE_JOBS al valor original
// ------------------------------------------------------------
console.log('\n--- cleanup ---');

test('restaurar ENABLE_JOBS=false', () => {
    process.env.ENABLE_JOBS = 'false';
    assert.strictEqual(process.env.ENABLE_JOBS, 'false');
});

// ------------------------------------------------------------
// Resultado final
// ------------------------------------------------------------
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

// Salir con código de error si algo falló (para CI)
process.exit(failed > 0 ? 1 : 0);