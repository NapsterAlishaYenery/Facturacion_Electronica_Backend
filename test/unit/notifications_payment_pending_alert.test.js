// ============================================================
// TEST: templates/payment-pending-alert (Step 6.13)
// Ejecutar: node test/unit/notifications_payment_pending_alert.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/payment-pending-alert');
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
    company: { id: 'c1', name: 'ExpediNap', rnc: '02800918407', email: 'info@expedinap.com' },
    owner: { firstName: 'Guerlmy', email: 'guerlmyn@gmail.com' },
    plan: { name: 'Plan Básico' },
    amount: 1000,
    currency: 'DOP',
    periodStart: new Date('2026-10-10T00:00:00'),
    periodEnd: new Date('2026-11-09T00:00:00'),
    paymentDueAt: new Date('2026-10-20T00:00:00')
};

console.log('=== payment-pending-alert — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({
        companyName: 'ExpediNap', planName: 'Plan Básico', amount: 1000
    });
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene plan', s.includes('Plan Básico'));
    test('contiene monto', s.includes('1000.00'));
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
    test('html tiene acción sugerida', result.html.includes('contactar al cliente'));
    test('text tiene estructura interna', result.text.includes('NUEVO PAGO PENDIENTE'));
}

console.log('\n=== Sin owner ===\n');
{
    const result = tpl.render({ ...sample, owner: null });
    test('sin owner no rompe', typeof result.html === 'string');
    test('no muestra sección dueño', !result.html.includes('👤 Dueño'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(() => tpl.render({ amount: 100 }), 'company is required');
    test('lanza sin company', noCompany.ok, noCompany.error);

    const noAmount = assertThrows(() => tpl.render({ company: { name: 'X' } }), 'amount is required');
    test('lanza sin amount', noAmount.ok, noAmount.error);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);