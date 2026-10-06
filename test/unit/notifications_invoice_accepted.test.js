// ============================================================
// TEST: templates/invoice-accepted (Step 6.11)
// Ejecutar: node test/unit/notifications_invoice_accepted.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/invoice-accepted');
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

console.log('=== invoice-accepted — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ invoice: sampleInvoice, company: sampleCompany });
    test('contiene NCF', s.includes('E310000000042'));
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene "aceptada"', s.toLowerCase().includes('aceptada'));
    test('prefijo ✅', s.startsWith('✅'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({ invoice: sampleInvoice, company: sampleCompany });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene NCF', result.html.includes('E310000000042'));
    test('html contiene total', result.html.includes('1180.00'));
    test('html contiene "aceptada"', result.html.includes('aceptada'));
    test('html tiene checkmark visual', result.html.includes('✅'));
    test('text contiene NCF', result.text.includes('E310000000042'));
    test('text contiene "ACEPTADA"', result.text.includes('ACEPTADA'));
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
        invoice: { ...sampleInvoice, ncf: '<script>alert(1)</script>' },
        company: sampleCompany
    });
    test('escapa <script>', !result.html.includes('<script>alert(1)</script>'));
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