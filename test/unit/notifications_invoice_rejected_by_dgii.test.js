// ============================================================
// TEST: templates/invoice-rejected-by-dgii (Step 6.11)
// Ejecutar: node test/unit/notifications_invoice_rejected_by_dgii.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/invoice-rejected-by-dgii');
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
    createdAt: new Date('2026-10-05T10:30:00')
};

const sampleCompany = {
    id: 'comp-1',
    rnc: '02800918407',
    name: 'ExpediNap',
    email: 'info@expedinap.com'
};

console.log('=== invoice-rejected-by-dgii — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ invoice: sampleInvoice, company: sampleCompany });
    test('contiene NCF', s.includes('E310000000042'));
    test('contiene "rechazada"', s.toLowerCase().includes('rechazada'));
    test('prefijo 🔴', s.startsWith('🔴'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany,
        reason: 'RNC del comprador no válido'
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene NCF', result.html.includes('E310000000042'));
    test('html contiene motivo', result.html.includes('RNC del comprador no válido'));
    test('html tiene acciones sugeridas',
        result.html.includes('¿Qué debes hacer?'));
    test('html menciona "corrige"', result.html.toLowerCase().includes('corrige'));
    test('html dice "NO es válida fiscalmente"',
        result.html.includes('NO es válida fiscalmente'));
    test('text contiene motivo', result.text.includes('RNC del comprador no válido'));
    test('text contiene acciones', result.text.includes('¿QUÉ DEBES HACER?'));
}

console.log('\n=== Sin motivo ===\n');
{
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany
        // sin reason
    });
    test('sin reason no rompe', typeof result.html === 'string');
    test('sin reason no muestra "Motivo:"',
        !result.html.includes('<strong>Motivo:</strong>'));
}

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

console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        invoice: sampleInvoice,
        company: sampleCompany,
        reason: '<script>alert(1)</script>'
    });
    test('escapa <script> en motivo',
        !result.html.includes('<script>alert(1)</script>'));
}

console.log('\n=== Layout ===\n');
{
    const result = tpl.render({ invoice: sampleInvoice, company: sampleCompany });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);