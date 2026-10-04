// ============================================================
// TEST: config/notifications (Step 6.5)
// Ejecutar: node test/unit/notifications_config.test.js
//
// Re-requiere el módulo con distintos env vars limpiando el cache,
// así probamos varios escenarios en un solo proceso.
// ============================================================

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

// ------------------------------------------------------------
// Helper: limpia el require cache y re-requiere el config
// ------------------------------------------------------------
function reloadConfig() {
    delete require.cache[require.resolve('../../src/config/notifications')];
    return require('../../src/config/notifications');
}

// Guardar env vars originales
const ORIGINAL_ENV = { ...process.env };

function setEnv(vars) {
    // Limpiar las SMTP_* primero
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    // Setear las nuevas
    Object.assign(process.env, vars);
}

function restoreEnv() {
    for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
        if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
        else process.env[k] = ORIGINAL_ENV[k];
    }
}

// ------------------------------------------------------------
// 1. Config completo
// ------------------------------------------------------------
console.log('=== config completo ===\n');
setEnv({
    SMTP_HOST: 'smtp.hostinger.com',
    SMTP_PORT: '465',
    SMTP_USER: 'info@test.com',
    SMTP_PASS: 'secret',
    SMTP_FROM: 'Test <info@test.com>'
});
{
    const config = reloadConfig();
    test('host leído', config.email.host === 'smtp.hostinger.com');
    test('port numérico', config.email.port === 465);
    test('user leído', config.email.user === 'info@test.com');
    test('pass leído', config.email.pass === 'secret');
    test('from leído', config.email.from === 'Test <info@test.com>');
    test('secure=true en 465', config.email.secure === true);
    test('validateEmailConfig() pasa', config.validateEmailConfig() === true);
}

// ------------------------------------------------------------
// 2. secure=false en 587
// ------------------------------------------------------------
console.log('\n=== secure en puerto 587 ===\n');
setEnv({
    SMTP_HOST: 'smtp.test.local',
    SMTP_PORT: '587',
    SMTP_USER: 'u',
    SMTP_PASS: 'p'
});
{
    const config = reloadConfig();
    test('secure=false en 587', config.email.secure === false);
}

// ------------------------------------------------------------
// 3. Port por defecto (587) si no se pasa
// ------------------------------------------------------------
console.log('\n=== port por defecto ===\n');
setEnv({
    SMTP_HOST: 'smtp.test.local',
    SMTP_USER: 'u',
    SMTP_PASS: 'p'
    // sin SMTP_PORT
});
{
    const config = reloadConfig();
    test('port default 587', config.email.port === 587);
}

// ------------------------------------------------------------
// 4. validateEmailConfig() falla si falta algo
// ------------------------------------------------------------
console.log('\n=== validación de faltantes ===\n');
setEnv({
    // sin SMTP_HOST
    SMTP_USER: 'u',
    SMTP_PASS: 'p'
});
{
    const config = reloadConfig();
    let err = null;
    try { config.validateEmailConfig(); } catch (e) { err = e; }
    test('lanza si falta SMTP_HOST',
        err && err.message.includes('SMTP_HOST'), err?.message);
}

setEnv({
    SMTP_HOST: 'h',
    // sin SMTP_USER
    SMTP_PASS: 'p'
});
{
    const config = reloadConfig();
    let err = null;
    try { config.validateEmailConfig(); } catch (e) { err = e; }
    test('lanza si falta SMTP_USER',
        err && err.message.includes('SMTP_USER'), err?.message);
}

setEnv({
    SMTP_HOST: 'h',
    SMTP_USER: 'u'
    // sin SMTP_PASS
});
{
    const config = reloadConfig();
    let err = null;
    try { config.validateEmailConfig(); } catch (e) { err = e; }
    test('lanza si falta SMTP_PASS',
        err && err.message.includes('SMTP_PASS'), err?.message);
}

// ------------------------------------------------------------
// 5. from es opcional
// ------------------------------------------------------------
console.log('\n=== from opcional ===\n');
setEnv({
    SMTP_HOST: 'h',
    SMTP_USER: 'u',
    SMTP_PASS: 'p'
    // sin SMTP_FROM
});
{
    const config = reloadConfig();
    test('from undefined si no se pasa', config.email.from === undefined);
    test('validateEmailConfig() sigue pasando', config.validateEmailConfig() === true);
}

// ------------------------------------------------------------
// Restaurar env original
// ------------------------------------------------------------
restoreEnv();

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);