// ============================================================
// Test de integración: módulo audit (HTTP)
//
// Requiere:
//   - Server corriendo en http://localhost:4001
//   - BD arriba
//   - .env con TEST_ADMIN_EMAIL + TEST_ADMIN_PASSWORD
//   - .env con TEST_COMPANY_ADMIN_EMAIL + TEST_COMPANY_ADMIN_PASSWORD
//     (solo para el test de 403)
//
// Verifica:
//   1. Auth: sin cookie → 401; con company_admin → 403
//   2. Listado paginado: shape, defaults, filtros
//   3. Validación Joi: limit>200, UUID inválido → 400
//   4. /actions devuelve array con acciones reales
//
// Uso:
//   node test/integration/admin-audit.integration.test.js
// ============================================================

require('dotenv').config();
process.env.NODE_ENV = 'test';

const { request } = require('../helpers/http.helper');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    if (condition) passed++;
    else failed++;
    return condition;
}

// ------------------------------------------------------------
// Helper: extrae la cookie access_token del header Set-Cookie
// ------------------------------------------------------------
function extractAccessCookie(res) {
    const raw = res.headers?.['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    const accessCookie = cookies.find(c => c?.startsWith('access_token='));
    return accessCookie ? accessCookie.split(';')[0] : null;
}

// ------------------------------------------------------------
// Helper: login y devuelve cookie
// ------------------------------------------------------------
async function loginAs(email, password) {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return { res, cookie: extractAccessCookie(res) };
}

// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
(async () => {
    console.log('\n=== TESTS: admin-audit (integration HTTP) ===\n');

    // Validar credenciales
    const adminEmail = process.env.TEST_ADMIN_EMAIL;
    const adminPass = process.env.TEST_ADMIN_PASSWORD;
    const caEmail = process.env.TEST_COMPANY_ADMIN_EMAIL;
    const caPass = process.env.TEST_COMPANY_ADMIN_PASSWORD;

    if (!adminEmail || !adminPass) {
        console.log('⚠️  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD no definidos.');
        console.log('   Skip: los tests requieren login de admin.\n');
        process.exit(0);
    }

    try {
        // ----------------------------------------------------
        // Test 1: login admin OK
        // ----------------------------------------------------
        console.log('--- Test 1: login admin ---');
        const { res: loginRes, cookie: adminCookie } = await loginAs(adminEmail, adminPass);

        test('login status 200', loginRes.status === 200, `got ${loginRes.status}`);
        test('login success true', loginRes.body?.success === true);
        test('cookie access_token presente', !!adminCookie);

        if (!adminCookie) {
            console.log('\n❌ No se pudo obtener cookie de admin. Abortando.\n');
            process.exit(1);
        }

        // ----------------------------------------------------
        // Test 2: sin cookie → 401
        // ----------------------------------------------------
        console.log('\n--- Test 2: sin cookie → 401 ---');
        const noAuth = await request('/api/audit-logs');
        test('status 401', noAuth.status === 401, `got ${noAuth.status}`);
        test('code NO_TOKEN', noAuth.body?.error?.code === 'NO_TOKEN');

        // ----------------------------------------------------
        // Test 3: con company_admin → 403
        // ----------------------------------------------------
        console.log('\n--- Test 3: company_admin → 403 ---');
        if (caEmail && caPass) {
            const { res: caLoginRes, cookie: caCookie } = await loginAs(caEmail, caPass);
            if (caCookie) {
                const caRes = await request('/api/audit-logs', {
                    headers: { Cookie: caCookie }
                });
                test('status 403', caRes.status === 403, `got ${caRes.status}`);
                test('code INSUFFICIENT_ROLE', caRes.body?.error?.code === 'INSUFFICIENT_ROLE');
            } else {
                console.log('  ⚠️  No se pudo loguear company_admin, skip este test');
            }
        } else {
            console.log('  ⚠️  TEST_COMPANY_ADMIN_* no definidos, skip este test');
        }

        // ----------------------------------------------------
        // Test 4: listado paginado (defaults)
        // ----------------------------------------------------
        console.log('\n--- Test 4: listado paginado ---');
        const listRes = await request('/api/audit-logs?limit=5', {
            headers: { Cookie: adminCookie }
        });

        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('success true', listRes.body?.success === true);
        test('logs es array', Array.isArray(listRes.body?.data?.logs));
        test('pagination existe', !!listRes.body?.data?.pagination);
        test('pagination.page = 1', listRes.body?.data?.pagination?.page === 1);
        test('pagination.limit = 5', listRes.body?.data?.pagination?.limit === 5);
        test('logs.length <= 5', (listRes.body?.data?.logs?.length ?? 0) <= 5);

        // ----------------------------------------------------
        // Test 5: shape de un log
        // ----------------------------------------------------
        console.log('\n--- Test 5: shape de un log ---');
        const firstLog = listRes.body?.data?.logs?.[0];
        if (firstLog) {
            test('tiene id', typeof firstLog.id === 'string');
            test('tiene action (string)', typeof firstLog.action === 'string');
            test('tiene createdAt (ISO)', !isNaN(Date.parse(firstLog.createdAt)));
            test('tiene entity (string|null)', firstLog.entity === null || typeof firstLog.entity === 'string');
            test('company es objeto o null', firstLog.company === null || typeof firstLog.company === 'object');
            test('user es objeto o null', firstLog.user === null || typeof firstLog.user === 'object');
        } else {
            console.log('  ⚠️  No hay logs en BD, skip verificación de shape');
        }

        // ----------------------------------------------------
        // Test 6: onlyJobs=true
        // ----------------------------------------------------
        console.log('\n--- Test 6: onlyJobs=true ---');
        const jobsRes = await request('/api/audit-logs?onlyJobs=true&limit=10', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', jobsRes.status === 200);
        const allJobs = (jobsRes.body?.data?.logs ?? []).every(l => l.action.startsWith('job.'));
        test('todos action empiezan con "job."', allJobs);

        // ----------------------------------------------------
        // Test 7: action=user.
        // ----------------------------------------------------
        console.log('\n--- Test 7: action=user. ---');
        const userRes = await request('/api/audit-logs?action=user.&limit=10', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', userRes.status === 200);
        const allUser = (userRes.body?.data?.logs ?? []).every(l => l.action.startsWith('user.'));
        test('todos action empiezan con "user."', allUser);

        // ----------------------------------------------------
        // Test 8: entity=user
        // ----------------------------------------------------
        console.log('\n--- Test 8: entity=user ---');
        const entRes = await request('/api/audit-logs?entity=user&limit=10', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', entRes.status === 200);
        const allEntityUser = (entRes.body?.data?.logs ?? []).every(l => l.entity === 'user');
        test('todos entity === "user"', allEntityUser);

        // ----------------------------------------------------
        // Test 9: rango de fechas
        // ----------------------------------------------------
        console.log('\n--- Test 9: rango de fechas ---');
        const from = '2026-10-01';
        const to = '2026-12-31';
        const rangeRes = await request(`/api/audit-logs?from=${from}&to=${to}&limit=20`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', rangeRes.status === 200);
        const fromMs = Date.parse(from);
        const toMs = Date.parse(to) + 24 * 60 * 60 * 1000; // incluir fin del día
        const allInRange = (rangeRes.body?.data?.logs ?? []).every(l => {
            const t = Date.parse(l.createdAt);
            return t >= fromMs && t <= toMs;
        });
        test('todos createdAt en rango', allInRange);

        // ----------------------------------------------------
        // Test 10: validación limit > 200
        // ----------------------------------------------------
        console.log('\n--- Test 10: limit > 200 → 400 ---');
        const badLimit = await request('/api/audit-logs?limit=500', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badLimit.status === 400, `got ${badLimit.status}`);
        test('code VALIDATION_ERROR', badLimit.body?.error?.code === 'VALIDATION_ERROR');

        // ----------------------------------------------------
        // Test 11: companyId inválido → 400
        // ----------------------------------------------------
        console.log('\n--- Test 11: companyId inválido → 400 ---');
        const badUuid = await request('/api/audit-logs?companyId=no-es-uuid', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badUuid.status === 400, `got ${badUuid.status}`);
        test('code VALIDATION_ERROR', badUuid.body?.error?.code === 'VALIDATION_ERROR');

        // ----------------------------------------------------
        // Test 12: /actions devuelve array
        // ----------------------------------------------------
        console.log('\n--- Test 12: /actions ---');
        const actionsRes = await request('/api/audit-logs/actions', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', actionsRes.status === 200);
        test('actions es array', Array.isArray(actionsRes.body?.data?.actions));
        test('contiene user.login', (actionsRes.body?.data?.actions ?? []).includes('user.login'));

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    }

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();