// ============================================================
// TEST: templates/no-active-sequence (Step 6.12)
// Ejecutar: node test/unit/notifications_no_active_sequence.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/no-active-sequence');
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

console.log('=== no-active-sequence — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s1 = tpl.buildSubject({ type: '31', typeName: 'Factura de Crédito Fiscal Electrónica', companyName: 'ExpediNap' });
    test('contiene tipo', s1.includes('31'));
    test('contiene typeName', s1.includes('Factura de Crédito'));
    test('contiene empresa', s1.includes('ExpediNap'));
    test('prefijo 🔴', s1.startsWith('🔴'));

    const s2 = tpl.buildSubject({ type: '32', companyName: 'X' });
    test('sin typeName funciona', s2.includes('32'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        type: '31',
        typeName: 'Factura de Crédito Fiscal Electrónica',
        attemptedAt: new Date('2026-10-05T15:30:00')
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene tipo', result.html.includes('31'));
    test('html contiene typeName', result.html.includes('Factura de Crédito'));
    test('html contiene "NO puedes emitir"', result.html.includes('NO puedes emitir'));
    test('html tiene acciones sugeridas', result.html.includes('¿Qué debes hacer?'));
    test('html menciona DGII', result.html.includes('DGII'));
    test('html menciona soporte', result.html.includes(BRAND.supportEmail));
    test('text contiene empresa', result.text.includes('ExpediNap'));
    test('text contiene tipo', result.text.includes('31'));
    test('text menciona soporte', result.text.includes(BRAND.supportEmail));
}

console.log('\n=== Sin typeName ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        type: '41',
        attemptedAt: new Date()
    });
    test('sin typeName no rompe', typeof result.html === 'string');
    test('sin owner usa "usuario"', result.html.includes('usuario'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ type: '31' }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noType = assertThrows(
        () => tpl.render({ companyName: 'X' }),
        'type is required'
    );
    test('lanza sin type', noType.ok, noType.error);
}

console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        companyName: '<script>alert(1)</script>',
        type: '31'
    });
    test('escapa <script>', !result.html.includes('<script>alert(1)</script>'));
    test('contiene versión escapada', result.html.includes('&lt;script&gt;'));
}

console.log('\n=== Layout ===\n');
{
    const result = tpl.render({ companyName: 'X', type: '31' });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);