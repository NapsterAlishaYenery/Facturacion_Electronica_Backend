// ============================================================
// TEST: templates/payment-pending (Step 6.13)
// Ejecutar: node test/unit/notifications_payment_pending.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/payment-pending');
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
    periodStart: new Date('2026-10-10T00:00:00'),
    periodEnd: new Date('2026-11-09T00:00:00'),
    paymentDueAt: new Date('2026-10-20T00:00:00')
};

console.log('=== payment-pending — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ companyName: 'ExpediNap', planName: 'Plan Básico' });
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene plan', s.includes('Plan Básico'));
    test('contiene "Pago pendiente"', s.includes('Pago pendiente'));
    test('prefijo 💳', s.startsWith('💳'));
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
    test('html contiene fecha límite', result.html.includes('octubre'));
    test('html contiene "renovó"', result.html.includes('renovó'));
    test('html contiene CTA soporte', result.html.includes(BRAND.supportEmail));
    test('html menciona "correo de pago recibido"',
        result.html.includes('pago recibido') || result.html.toLowerCase().includes('confirmado'));
    test('text contiene monto', result.text.includes('RD$ 1000.00'));
    test('text contiene CTA soporte', result.text.includes(BRAND.supportEmail));
}

console.log('\n=== Moneda USD ===\n');
{
    const result = tpl.render({ ...sample, currency: 'USD', amount: 50 });
    test('formatea USD', result.html.includes('US$ 50.00'));
}

console.log('\n=== Sin opcionales ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        amount: 500,
        periodEnd: new Date('2026-11-01')
    });
    test('sin rnc/plan/owner no rompe', typeof result.html === 'string');
    test('sin owner usa "usuario"', result.html.includes('usuario'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(() => tpl.render({ amount: 100, periodEnd: new Date() }), 'companyName is required');
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noAmount = assertThrows(() => tpl.render({ companyName: 'X', periodEnd: new Date() }), 'amount is required');
    test('lanza sin amount', noAmount.ok, noAmount.error);

    const noEnd = assertThrows(() => tpl.render({ companyName: 'X', amount: 100 }), 'periodEnd is required');
    test('lanza sin periodEnd', noEnd.ok, noEnd.error);
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