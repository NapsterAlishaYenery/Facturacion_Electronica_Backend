// ============================================================
// TEST: templates/certificate-expiring (Step 6.7)
// Ejecutar: node test/unit/notifications_certificate_expiring.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/certificate-expiring');
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

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
console.log('=== certificate-expiring — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

// ------------------------------------------------------------
// buildSubject
// ------------------------------------------------------------
console.log('\n=== buildSubject ===\n');
{
    const s1 = tpl.buildSubject({ companyName: 'ExpediNap', daysLeft: 15, expired: false });
    test('por vencer: contiene "15 días"', s1.includes('15 días'));
    test('por vencer: contiene empresa', s1.includes('ExpediNap'));
    test('por vencer: prefijo ⚠️', s1.startsWith('⚠️'));

    const s2 = tpl.buildSubject({ companyName: 'ExpediNap', daysLeft: 1, expired: false });
    test('singular "1 día"', s2.includes('1 día') && !s2.includes('1 días'));

    const s3 = tpl.buildSubject({ companyName: 'ExpediNap', daysLeft: 0, expired: false });
    test('vence hoy', s3.includes('HOY'));

    const s4 = tpl.buildSubject({ companyName: 'ExpediNap', daysLeft: -1, expired: true });
    test('vencido: contiene "VENCIDO"', s4.includes('VENCIDO'));
    test('vencido: prefijo 🔴', s4.startsWith('🔴'));
    test('vencido: "hace 1 día"', s4.includes('hace 1 día'));
}

// ------------------------------------------------------------
// Happy path — por vencer
// ------------------------------------------------------------
console.log('\n=== Happy path — por vencer ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        expiresAt: new Date('2026-10-20T00:00:00'),
        daysLeft: 15,
        expired: false
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene "15 días"', result.html.includes('15 días'));
    test('html contiene "Por vencer"', result.html.includes('Por vencer'));
    test('html contiene fecha formateada', result.html.includes('octubre'));
    test('text contiene días y estado', result.text.includes('15 días'));
}

// ------------------------------------------------------------
// Happy path — vencido
// ------------------------------------------------------------
console.log('\n=== Happy path — vencido ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        expiresAt: new Date('2026-10-01T00:00:00'),
        daysLeft: -3,
        expired: true
    });

    test('html contiene "venció hace 3 días"',
        result.html.includes('venció hace 3 días'));
    test('html contiene "VENCIDO"', result.html.includes('VENCIDO'));
    test('html advierte "NO puedes emitir"',
        result.html.includes('NO puedes emitir'));
}

// ------------------------------------------------------------
// Sin RNC ni owner (opcionales)
// ------------------------------------------------------------
console.log('\n=== Sin opcionales ===\n');
{
    const result = tpl.render({
        companyName: 'Test',
        expiresAt: new Date('2026-10-20'),
        daysLeft: 7
    });
    test('sin RNC no rompe', typeof result.html === 'string');
    test('sin owner usa "usuario"', result.html.includes('usuario'));
}

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------
console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ expiresAt: new Date(), daysLeft: 5 }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noDate = assertThrows(
        () => tpl.render({ companyName: 'X', daysLeft: 5 }),
        'expiresAt is required'
    );
    test('lanza sin expiresAt', noDate.ok, noDate.error);

    const noDays = assertThrows(
        () => tpl.render({ companyName: 'X', expiresAt: new Date() }),
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
        expiresAt: new Date('2026-10-20'),
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
        expiresAt: new Date('2026-10-20'),
        daysLeft: 7
    });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);