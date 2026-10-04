// ============================================================
// TEST: templates/welcome (Step 6.6b)
// Ejecutar: node test/unit/notifications_welcome.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/welcome');
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

console.log('=== welcome — API ===\n');
test('exporta subject', typeof tpl.subject === 'string' && tpl.subject.length > 0);
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        name: 'Juan',
        companyName: 'Barbería Juan SRL',
        rnc: '130999888',
        planName: 'Plan Básico',
        trialDays: 25
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene el nombre', result.html.includes('Juan'));
    test('html contiene la empresa', result.html.includes('Barbería Juan SRL'));
    test('html contiene el RNC', result.html.includes('130999888'));
    test('html contiene el plan', result.html.includes('Plan Básico'));
    test('html contiene el trial', result.html.includes('25 días'));
    test('text contiene el trial', result.text.includes('25 días'));
    test('NO contiene botón "Iniciar sesión"',
        !result.html.includes('Iniciar sesión') || !result.html.includes('<a href'));
}

console.log('\n=== Sin opcionales ===\n');
{
    const result = tpl.render({
        companyName: 'Solo SRL',
        trialDays: 25
    });
    test('usa "usuario" como nombre', result.html.includes('usuario'));
    test('sin RNC no rompe', typeof result.html === 'string');
    test('sin plan no rompe', typeof result.html === 'string');
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(() => tpl.render({ trialDays: 25 }), 'companyName is required');
    test('lanza si falta companyName', noCompany.ok, noCompany.error);

    const noTrial = assertThrows(() => tpl.render({ companyName: 'X' }), 'trialDays is required');
    test('lanza si falta trialDays', noTrial.ok, noTrial.error);
}

console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        companyName: '<script>alert(1)</script>',
        trialDays: 25
    });
    test('escapa <script>', !result.html.includes('<script>'));
}

console.log('\n=== Layout integrado ===\n');
{
    const result = tpl.render({ companyName: 'X', trialDays: 25 });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);