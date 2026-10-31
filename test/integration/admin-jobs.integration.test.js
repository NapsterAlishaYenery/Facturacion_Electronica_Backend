// ============================================================
// Test de integración: módulo jobs (HTTP)
//
// Requiere:
//   - Server corriendo en http://localhost:4001
//   - BD arriba
//   - .env con TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD
//
// Verifica:
//   1. Auth: sin cookie → 401; con admin → 200
//   2. GET /api/jobs → shape { enabled, timezone, jobs }
//   3. GET /api/jobs/runs → paginación y filtros
//   4. Forzar corridas en BD → aparecen en /runs
//   5. Validación Joi → 400
//   6. Cleanup automático de datos de test
//
// Nota: NO espera al cron. Inserta JobRun.create() directo con
// jobName="__test-integration-<timestamp>" y limpia al final.
//
// Uso:
//   node test/integration/admin-jobs.integration.test.js
// ============================================================

require('dotenv').config();
process.env.NODE_ENV = 'test';

const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { JobRun } = require('../../src/models');
const { Op } = require('sequelize');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    if (condition) passed++;
    else failed++;
    return condition;
}

function extractAccessCookie(res) {
    const raw = res.headers?.['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    const accessCookie = cookies.find(c => c?.startsWith('access_token='));
    return accessCookie ? accessCookie.split(';')[0] : null;
}

async function loginAs(email, password) {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return { res, cookie: extractAccessCookie(res) };
}

// Prefijo único por corrida para no tocar datos reales
const RUN_ID = Date.now();
const TEST_PREFIX = `__test-integration-${RUN_ID}`;

// Helper: construir un JobRun de prueba
function buildTestRun({ jobName, status = 'success', startedAt, affected = 1 }) {
    return {
        jobName,
        status,
        affected,
        durationMs: 100,
        error: status === 'failed' ? 'simulated' : null,
        meta: { test: true, runId: RUN_ID },
        triggeredBy: 'cron',
        startedAt: startedAt || new Date()
    };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
(async () => {
    console.log('\n=== TESTS: admin-jobs (integration HTTP) ===\n');

    const adminEmail = process.env.TEST_ADMIN_EMAIL;
    const adminPass = process.env.TEST_ADMIN_PASSWORD;

    if (!adminEmail || !adminPass) {
        console.log('⚠️  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD no definidos.');
        console.log('   Skip: los tests requieren login de admin.\n');
        process.exit(0);
    }

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ----------------------------------------------------
        // Test 1: login admin
        // ----------------------------------------------------
        console.log('--- Test 1: login admin ---');
        const { res: loginRes, cookie: adminCookie } = await loginAs(adminEmail, adminPass);
        test('login status 200', loginRes.status === 200, `got ${loginRes.status}`);
        test('cookie access_token presente', !!adminCookie);

        if (!adminCookie) {
            console.log('\n❌ Sin cookie, abortando\n');
            process.exit(1);
        }

        // ----------------------------------------------------
        // Test 2: sin cookie → 401
        // ----------------------------------------------------
        console.log('\n--- Test 2: sin cookie → 401 ---');
        const noAuth = await request('/api/jobs');
        test('status 401', noAuth.status === 401, `got ${noAuth.status}`);
        test('code NO_TOKEN', noAuth.body?.error?.code === 'NO_TOKEN');

        // ----------------------------------------------------
        // Test 3: GET /api/jobs (shape)
        // ----------------------------------------------------
        console.log('\n--- Test 3: GET /api/jobs ---');
        const overview = await request('/api/jobs', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', overview.status === 200);
        test('success true', overview.body?.success === true);
        test('data tiene enabled (boolean)', typeof overview.body?.data?.enabled === 'boolean');
        test('data tiene timezone (string)', typeof overview.body?.data?.timezone === 'string');
        test('data.jobs es array', Array.isArray(overview.body?.data?.jobs));

        // ----------------------------------------------------
        // Test 4: runs vacío o con datos (baseline)
        // ----------------------------------------------------
        console.log('\n--- Test 4: GET /api/jobs/runs (baseline) ---');
        const runsInitial = await request('/api/jobs/runs?limit=5', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', runsInitial.status === 200);
        test('runs es array', Array.isArray(runsInitial.body?.data?.runs));
        test('pagination existe', !!runsInitial.body?.data?.pagination);
        test('pagination.page = 1', runsInitial.body?.data?.pagination?.page === 1);

        // ----------------------------------------------------
        // Test 5: forzar corridas (insert directo)
        // ----------------------------------------------------
        console.log('\n--- Test 5: insertar corridas de prueba ---');
        const now = Date.now();
        const insertedRuns = await JobRun.bulkCreate([
            buildTestRun({ jobName: `${TEST_PREFIX}-a`, status: 'success', startedAt: new Date(now - 2 * DAY_MS), affected: 10 }),
            buildTestRun({ jobName: `${TEST_PREFIX}-b`, status: 'failed', startedAt: new Date(now - 1 * DAY_MS), affected: 0 }),
            buildTestRun({ jobName: `${TEST_PREFIX}-c`, status: 'skipped', startedAt: new Date(now - 1000), affected: 0 })
        ]);
        test('se insertaron 3 corridas', insertedRuns.length === 3);

        // ----------------------------------------------------
        // Test 6: /runs ahora trae las de test
        // ----------------------------------------------------
        console.log('\n--- Test 6: /runs trae las de test ---');
        const runsAfter = await request('/api/jobs/runs?limit=50', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', runsAfter.status === 200);
        const testRuns = (runsAfter.body?.data?.runs ?? []).filter(r => r.jobName.startsWith(TEST_PREFIX));
        test('al menos 3 corridas de test', testRuns.length >= 3, `encontradas: ${testRuns.length}`);

        // ----------------------------------------------------
        // Test 7: filtro por jobName
        // ----------------------------------------------------
        console.log('\n--- Test 7: filtro jobName ---');
        const byJob = await request(`/api/jobs/runs?jobName=${TEST_PREFIX}-a`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', byJob.status === 200);
        const onlyA = (byJob.body?.data?.runs ?? []).every(r => r.jobName === `${TEST_PREFIX}-a`);
        test('solo trae jobName específico', onlyA);
        test('al menos 1 item', (byJob.body?.data?.runs ?? []).length >= 1);

        // ----------------------------------------------------
        // Test 8: filtro por status=failed
        // ----------------------------------------------------
        console.log('\n--- Test 8: filtro status=failed ---');
        const byStatus = await request('/api/jobs/runs?status=failed&limit=20', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', byStatus.status === 200);
        const allFailed = (byStatus.body?.data?.runs ?? []).every(r => r.status === 'failed');
        test('todos status "failed"', allFailed);

        // ----------------------------------------------------
        // Test 9: filtro por rango de fechas
        // ----------------------------------------------------
        console.log('\n--- Test 9: rango de fechas ---');
        const from = new Date(now - 3 * DAY_MS).toISOString().slice(0, 10);
        const to = new Date(now + DAY_MS).toISOString().slice(0, 10);
        const byRange = await request(`/api/jobs/runs?from=${from}&to=${to}&limit=20`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', byRange.status === 200);
        test('trae las de test (están en rango)', (byRange.body?.data?.runs ?? []).length >= 3);

        // ----------------------------------------------------
        // Test 10: paginación limit=2
        // ----------------------------------------------------
        console.log('\n--- Test 10: paginación limit=2 ---');
        const paged = await request('/api/jobs/runs?limit=2&page=1', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', paged.status === 200);
        test('runs.length <= 2', (paged.body?.data?.runs ?? []).length <= 2);
        test('pagination.limit = 2', paged.body?.data?.pagination?.limit === 2);

        // ----------------------------------------------------
        // Test 11: validación status inválido → 400
        // ----------------------------------------------------
        console.log('\n--- Test 11: status inválido → 400 ---');
        const badStatus = await request('/api/jobs/runs?status=invented', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badStatus.status === 400, `got ${badStatus.status}`);
        test('code VALIDATION_ERROR', badStatus.body?.error?.code === 'VALIDATION_ERROR');

        // ----------------------------------------------------
        // Test 12: validación limit > 200 → 400
        // ----------------------------------------------------
        console.log('\n--- Test 12: limit > 200 → 400 ---');
        const badLimit = await request('/api/jobs/runs?limit=500', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badLimit.status === 400);
        test('code VALIDATION_ERROR', badLimit.body?.error?.code === 'VALIDATION_ERROR');

        // ----------------------------------------------------
        // Test 13: overview refleja lastRun de BD
        // ----------------------------------------------------
        console.log('\n--- Test 13: overview usa lastRun de BD ---');
        const overview2 = await request('/api/jobs', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', overview2.status === 200);
        // No podemos verificar un job específico porque los tests insertaron
        // nombres con prefijo que NO están en las definiciones del scheduler.
        // Pero SÍ verificamos que el shape es correcto y hay jobs definidos.
        test('data.jobs es array', Array.isArray(overview2.body?.data?.jobs));

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        // ----------------------------------------------------
        // Cleanup: borrar todas las corridas de test
        // ----------------------------------------------------
        try {
            const deleted = await JobRun.destroy({
                where: { jobName: { [Op.like]: `${TEST_PREFIX}%` } }
            });
            console.log(`\n🧹 Cleanup: ${deleted} filas de job_runs eliminadas`);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }

        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

        await sequelize.close();
        process.exit(failed > 0 ? 1 : 0);
    }
})();