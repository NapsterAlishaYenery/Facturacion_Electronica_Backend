// ============================================================
// TEST: templates/sequences-alert (Step 6.8)
// Ejecutar: node test/unit/notifications_sequences_alert.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/sequences-alert');
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

const sampleSeq = {
    id: 'seq-1',
    type: '31',
    prefix: 'E',
    startNumber: 1,
    endNumber: 100,
    currentNumber: 92,
    expiresAt: new Date('2026-10-20T00:00:00'),
    reason: 'lowStock'
};

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
console.log('=== sequences-alert — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

// ------------------------------------------------------------
// buildSubject
// ------------------------------------------------------------
console.log('\n=== buildSubject ===\n');
{
    const s1 = tpl.buildSubject({ companyName: 'ExpediNap', count: 1, reason: 'expiring' });
    test('1 secuencia singular', s1.includes('1 secuencia') && !s1.includes('1 secuencias'));

    const s2 = tpl.buildSubject({ companyName: 'ExpediNap', count: 3, reason: 'lowStock' });
    test('3 secuencias plural', s2.includes('3 secuencias'));

    const s3 = tpl.buildSubject({ companyName: 'X', count: 2, reason: 'mixed' });
    test('mixed: "requieren atención"', s3.includes('atención'));
}

// ------------------------------------------------------------
// Happy path — lowStock
// ------------------------------------------------------------
console.log('\n=== Happy path — lowStock ===\n');
{
    const result = tpl.render({
        companyName: 'ExpediNap',
        rnc: '02800918407',
        ownerName: 'Guerlmy',
        reason: 'lowStock',
        sequences: [sampleSeq]
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene el rango NCF', result.html.includes('0000000001'));
    test('html contiene "Quedan 8"',
        result.html.includes('Quedan 8'));
    test('text contiene el rango', result.text.includes('E31'));
}

// ------------------------------------------------------------
// Múltiples secuencias
// ------------------------------------------------------------
console.log('\n=== Múltiples secuencias ===\n');
{
    const result = tpl.render({
        companyName: 'Test SRL',
        reason: 'mixed',
        sequences: [
            sampleSeq,
            { ...sampleSeq, id: 'seq-2', type: '32', expiresAt: new Date('2026-10-10'), reason: 'expiring' }
        ]
    });

    test('html contiene E31', result.html.includes('E31'));
    test('html contiene E32', result.html.includes('E32'));
    test('html contiene "Vence el"', result.html.includes('Vence el'));
    test('text tiene 2 líneas de secuencia', result.text.split('•').length >= 3);
}

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------
console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ reason: 'lowStock', sequences: [sampleSeq] }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noSeq = assertThrows(
        () => tpl.render({ companyName: 'X', reason: 'lowStock', sequences: [] }),
        'sequences array is required'
    );
    test('lanza sin sequences', noSeq.ok, noSeq.error);

    const badReason = assertThrows(
        () => tpl.render({ companyName: 'X', reason: 'foo', sequences: [sampleSeq] }),
        'unknown reason'
    );
    test('lanza con reason inválido', badReason.ok, badReason.error);
}

// ------------------------------------------------------------
// Escape XSS
// ------------------------------------------------------------
console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        companyName: '<script>alert(1)</script>',
        reason: 'lowStock',
        sequences: [sampleSeq]
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
        reason: 'lowStock',
        sequences: [sampleSeq]
    });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);