// ============================================================
// TEST: templates/subscription-expiring (Step 6.9)
// Ejecutar: node test/unit/notifications_subscription_expiring.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/subscription-expiring');
const BRAND = require('../../src/constants/brand');

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

function assertThrows(fn, msgIncludes) {
    try {
        fn();
        return { ok: false, error: 'did not throw' };
    } catch (e) {
        return { ok: e.message.includes(msgIncludes), error: e.message };
    }
}

const sampleExpiresAt = new Date('2026-10-20T00:00:00');

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
console.log('=== subscription-expiring — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

// ------------------------------------------------------------
// buildSubject
// ------------------------------------------------------------
console.log('\n=== buildSubject ===\n');
{
    const s1 = tpl.buildSubject({
        companyName: 'ExpediNap', status: 'trial', planName: null, daysLeft: 7
    });
    test('trial: contiene "prueba"', s1.toLowerCase().includes('prueba'));
    test('trial: contiene "en 7 días"', s1.includes('en 7 días'));

    const s2 = tpl.buildSubject({
        companyName: 'ExpediNap', status: 'trial', planName: null, daysLeft: 1
    });
    test('trial: "mañana" cuando daysLeft=1', s2.includes('mañana'));

    const s3 = tpl.buildSubject({
        companyName: 'ExpediNap', status: 'active', planName: 'Plan Pro', daysLeft: 3
    });
    test('active: contiene plan', s3.includes('Plan Pro'));
    test('active: contiene "en 3 días"', s3.includes('en 3 días'));
}

// ------------------------------------------------------------
// Happy path — trial
// ------------------------------------------------------------
console.log('\n=== Happy path — trial ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        status: 'trial',
        planName: 'Plan Básico',
        expiresAt: sampleExpiresAt,
        daysLeft: 7
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene "prueba"', result.html.toLowerCase().includes('prueba'));
    test('html contiene "7 días"', result.html.includes('7 días'));
    test('html contiene el email de soporte', result.html.includes(BRAND.supportEmail));
    test('text contiene empresa', result.text.includes('ExpediNap'));
    test('text contiene email soporte', result.text.includes(BRAND.supportEmail));
}

// ------------------------------------------------------------
// Happy path — active
// ------------------------------------------------------------
console.log('\n=== Happy path — active ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        status: 'active',
        planName: 'Plan Pro',
        expiresAt: sampleExpiresAt,
        daysLeft: 3
    });

    test('html contiene "Plan Pro"', result.html.includes('Plan Pro'));
    test('html contiene "3 días"', result.html.includes('3 días'));
    test('html NO dice "prueba"', !result.html.toLowerCase().includes('prueba'));
}

// ------------------------------------------------------------
// Días singular
// ------------------------------------------------------------
console.log('\n=== Días singular ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        status: 'trial',
        expiresAt: sampleExpiresAt,
        daysLeft: 1
    });
    test('dice "1 día"', result.html.includes('1 día') && !result.html.includes('1 días'));
}

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------
console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ status: 'trial', expiresAt: sampleExpiresAt, daysLeft: 5 }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noStatus = assertThrows(
        () => tpl.render({ companyName: 'X', expiresAt: sampleExpiresAt, daysLeft: 5 }),
        'status is required'
    );
    test('lanza sin status', noStatus.ok, noStatus.error);

    const badStatus = assertThrows(
        () => tpl.render({ companyName: 'X', status: 'expired', expiresAt: sampleExpiresAt, daysLeft: 5 }),
        'unknown status'
    );
    test('lanza con status inválido', badStatus.ok, badStatus.error);

    const noDate = assertThrows(
        () => tpl.render({ companyName: 'X', status: 'trial', daysLeft: 5 }),
        'expiresAt is required'
    );
    test('lanza sin expiresAt', noDate.ok, noDate.error);

    const noDays = assertThrows(
        () => tpl.render({ companyName: 'X', status: 'trial', expiresAt: sampleExpiresAt }),
        'daysLeft is required'
    );
    test('lanza sin daysLeft', noDays.ok, noDays.error);
}

// ------------------------------------------------------------
// Escape XSS
// ------------------------------------------------------------
console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        companyName: '<script>alert(1)</script>',
        status: 'trial',
        expiresAt: sampleExpiresAt,
        daysLeft: 7
    });
    test('escapa <script>', !result.html.includes('<script>alert(1)</script>'));
    test('contiene versión escapada', result.html.includes('&lt;script&gt;'));
}

// ------------------------------------------------------------
// Layout
// ------------------------------------------------------------
console.log('\n=== Layout integrado ===\n');
{
    const result = tpl.render({
        companyName: 'Test',
        status: 'trial',
        expiresAt: sampleExpiresAt,
        daysLeft: 7
    });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);