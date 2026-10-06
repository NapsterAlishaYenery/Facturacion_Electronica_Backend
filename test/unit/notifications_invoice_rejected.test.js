// ============================================================
// TEST: templates/invoice-rejected (Step 6.10)
// Ejecutar: node test/unit/notifications_invoice_rejected.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/invoice-rejected');
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

const sampleInvoice = {
    id: 'inv-1',
    ncf: 'E310000000042',
    type: '31',
    total: 1180,
    issuedAt: new Date('2026-10-05T10:30:00'),
    createdAt: new Date('2026-10-05T10:30:00'),
    sendAttempts: 5
};

const sampleCompany = {
    id: 'comp-1',
    rnc: '02800918407',
    name: 'ExpediNap',
    email: 'info@expedinap.com'
};

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
console.log('=== invoice-rejected — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

// ------------------------------------------------------------
// buildSubject
// ------------------------------------------------------------
console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ invoice: sampleInvoice, company: sampleCompany });
    test('contiene NCF', s.includes('E310000000042'));
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene "rechazada"', s.toLowerCase().includes('rechazada'));
    test('prefijo 🔴', s.startsWith('🔴'));
}

// ------------------------------------------------------------
// Happy path
// ------------------------------------------------------------
console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany,
        attempts: 5,
        error: 'Connection timeout after 30s'
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene NCF', result.html.includes('E310000000042'));
    test('html contiene tipo', result.html.includes('31'));
    test('html contiene total formateado', result.html.includes('1180.00'));
    test('html contiene el error', result.html.includes('Connection timeout'));
    test('html tiene acciones sugeridas',
        result.html.includes('Acciones sugeridas'));
    test('html menciona "certificado digital"',
        result.html.includes('certificado digital'));
    test('text contiene NCF', result.text.includes('E310000000042'));
    test('text contiene el error', result.text.includes('Connection timeout'));
}

// ------------------------------------------------------------
// Sin error (no debería pasar pero es defensivo)
// ------------------------------------------------------------
console.log('\n=== Sin error ===\n');
{
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany,
        attempts: 5
        // sin error
    });
    test('sin error no rompe', typeof result.html === 'string');
    test('sin error no muestra bloque error',
        !result.html.includes('Último error'));
}

// ------------------------------------------------------------
// Truncado de errores largos
// ------------------------------------------------------------
console.log('\n=== Truncado de error ===\n');
{
    const longError = 'X'.repeat(2000);
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany,
        attempts: 5,
        error: longError
    });
    test('error largo fue truncado', result.html.includes('[truncado]'));
    test('html no excede 500 chars de error',
        !result.html.includes('X'.repeat(600)));
}

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------
console.log('\n=== Validaciones ===\n');
{
    const noInvoice = assertThrows(
        () => tpl.render({ company: sampleCompany }),
        'invoice is required'
    );
    test('lanza sin invoice', noInvoice.ok, noInvoice.error);

    const noCompany = assertThrows(
        () => tpl.render({ invoice: sampleInvoice }),
        'company is required'
    );
    test('lanza sin company', noCompany.ok, noCompany.error);
}

// ------------------------------------------------------------
// Escape XSS
// ------------------------------------------------------------
console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        invoice: { ...sampleInvoice, ncf: '<script>alert(1)</script>' },
        company: sampleCompany,
        attempts: 5,
        error: 'x'
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
        invoice: sampleInvoice,
        company: sampleCompany,
        attempts: 5,
        error: 'x'
    });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);