// ============================================================
// TEST: templates/plan-changed (Step 6.16)
// Ejecutar: node test/unit/notifications_plan_changed.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/plan-changed');
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
    oldPlanName: 'Plan Básico',
    newPlanName: 'Plan Pro',
    amount: 2500,
    currency: 'DOP',
    periodStart: new Date('2026-10-10T00:00:00'),
    periodEnd: new Date('2026-11-09T00:00:00'),
    paymentDueAt: new Date('2026-10-20T00:00:00')
};

console.log('=== plan-changed — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ companyName: 'ExpediNap', newPlanName: 'Plan Pro' });
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene nuevo plan', s.includes('Plan Pro'));
    test('contiene "Cambio de plan confirmado"',
        s.includes('Cambio de plan confirmado'));
    test('prefijo 🔄', s.startsWith('🔄'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render(sample);

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene plan anterior', result.html.includes('Plan Básico'));
    test('html contiene plan nuevo', result.html.includes('Plan Pro'));
    test('html contiene monto', result.html.includes('RD$ 2500.00'));
    test('html contiene fecha límite', result.html.includes('octubre'));
    test('html contiene "Pago pendiente"', result.html.includes('Pago pendiente'));
    test('html contiene CTA soporte', result.html.includes(BRAND.supportEmail));
    test('html advierte "Si no solicitaste"',
        result.html.includes('Si no solicitaste'));
    test('text contiene ambos planes',
        result.text.includes('Plan Básico') && result.text.includes('Plan Pro'));
}

console.log('\n=== Sin plan anterior (no aplica) ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        newPlanName: 'Plan Pro',
        amount: 2500
    });
    test('sin oldPlan no rompe', typeof result.html === 'string');
    test('sin oldPlan no muestra "Plan anterior"',
        !result.html.includes('Plan anterior'));
}

console.log('\n=== Sin amount (raro pero defensivo) ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        newPlanName: 'Plan Pro'
    });
    test('sin amount no muestra bloque de pago',
        !result.html.includes('Pago pendiente del nuevo plan'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ newPlanName: 'Plan Pro' }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noNewPlan = assertThrows(
        () => tpl.render({ companyName: 'X' }),
        'newPlanName is required'
    );
    test('lanza sin newPlanName', noNewPlan.ok, noNewPlan.error);
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