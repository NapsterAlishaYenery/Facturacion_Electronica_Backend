// ============================================================
// TEST: templates/payment-received (Step 6.14)
// Ejecutar: node test/unit/notifications_payment_received.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/payment-received');
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

const sample = {
    companyName: 'ExpediNap',
    rnc: '02800918407',
    ownerName: 'Guerlmy',
    planName: 'Plan Básico',
    amount: 1000,
    currency: 'DOP',
    paymentMethod: 'transfer',
    reference: 'TRF-2026-001',
    periodStart: new Date('2026-10-10T00:00:00'),
    periodEnd: new Date('2026-11-09T00:00:00'),
    paidAt: new Date('2026-10-10T15:30:00')
};

console.log('=== payment-received — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ companyName: 'ExpediNap', planName: 'Plan Básico' });
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene plan', s.includes('Plan Básico'));
    test('contiene "Pago recibido"', s.includes('Pago recibido'));
    test('prefijo ✅', s.startsWith('✅'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render(sample);

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene plan', result.html.includes('Plan Básico'));
    test('html contiene monto RD$', result.html.includes('RD$ 1000.00'));
    test('html contiene método legible "Transferencia bancaria"',
        result.html.includes('Transferencia bancaria'));
    test('html contiene referencia', result.html.includes('TRF-2026-001'));
    test('html contiene "Pago recibido correctamente"',
        result.html.includes('Pago recibido correctamente'));
    test('html contiene nota de "cuenta activa"',
        result.html.includes('cuenta está activa'));
    test('html menciona "comprobante"',
        result.html.toLowerCase().includes('comprobante'));
    test('text contiene monto', result.text.includes('RD$ 1000.00'));
    test('text contiene método legible', result.text.includes('Transferencia bancaria'));
}

console.log('\n=== Sin opcionales ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        amount: 500
    });
    test('sin rnc/owner/plan no rompe', typeof result.html === 'string');
    test('sin owner usa "usuario"', result.html.includes('usuario'));
    test('sin método no muestra fila método',
        !result.html.includes('Método:'));
    test('sin referencia no muestra fila referencia',
        !result.html.includes('Referencia:'));
}

console.log('\n=== Moneda USD ===\n');
{
    const result = tpl.render({ ...sample, currency: 'USD', amount: 50 });
    test('formatea USD', result.html.includes('US$ 50.00'));
}

console.log('\n=== Métodos de pago mapeados ===\n');
{
    const methods = [
        ['cash', 'Efectivo'],
        ['transfer', 'Transferencia bancaria'],
        ['card', 'Tarjeta'],
        ['check', 'Cheque'],
        ['other', 'Otro']
    ];
    for (const [code, label] of methods) {
        const result = tpl.render({ ...sample, paymentMethod: code });
        test(`método "${code}" → "${label}"`, result.html.includes(label));
    }
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(() => tpl.render({ amount: 100 }), 'companyName is required');
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noAmount = assertThrows(() => tpl.render({ companyName: 'X' }), 'amount is required');
    test('lanza sin amount', noAmount.ok, noAmount.error);
}

console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({ ...sample, companyName: '<script>alert(1)</script>' });
    test('escapa <script>', !result.html.includes('<script>alert(1)</script>'));
}

console.log('\n=== Layout ===\n');
{
    const result = tpl.render(sample);
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);