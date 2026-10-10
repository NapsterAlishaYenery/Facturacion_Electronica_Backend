// ============================================================
// TEST: templates/subscription-cancelled (Step 6.15)
// Ejecutar: node test/unit/notifications_subscription_cancelled.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/subscription-cancelled');
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
    cancelledAt: new Date('2026-10-10T15:30:00'),
    accessUntil: new Date('2026-11-09T00:00:00'),
    daysLeft: 30
};

console.log('=== subscription-cancelled — API ===\n');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');
test('exporta render', typeof tpl.render === 'function');

console.log('\n=== buildSubject ===\n');
{
    const s = tpl.buildSubject({ companyName: 'ExpediNap' });
    test('contiene empresa', s.includes('ExpediNap'));
    test('contiene "cancelada"', s.toLowerCase().includes('cancelada'));
    test('prefijo 🚫', s.startsWith('🚫'));
}

console.log('\n=== Happy path con acceso restante ===\n');
{
    const result = tpl.render(sample);

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene empresa', result.html.includes('ExpediNap'));
    test('html contiene RNC', result.html.includes('02800918407'));
    test('html contiene owner', result.html.includes('Guerlmy'));
    test('html contiene plan', result.html.includes('Plan Básico'));
    test('html contiene "cancelada"', result.html.includes('cancelada'));
    test('html contiene fecha de acceso', result.html.includes('noviembre'));
    test('html contiene "30 días"', result.html.includes('30 días'));
    test('html dice "Puedes seguir usando"',
        result.html.includes('Puedes seguir usando'));
    test('html menciona reactivación', result.html.toLowerCase().includes('reactivar'));
    test('html advierte "Si NO solicitaste"',
        result.html.includes('Si NO solicitaste'));
    test('text contiene los datos', result.text.includes('ExpediNap'));
}

console.log('\n=== Sin acceso restante (díasLeft=0) ===\n');
{
    const result = tpl.render({
        ...sample,
        accessUntil: new Date(),
        daysLeft: 0
    });
    test('dice "acceso al sistema ha sido cerrado"',
        result.html.includes('acceso al sistema ha sido cerrado'));
    test('no dice "Puedes seguir usando"',
        !result.html.includes('Puedes seguir usando'));
}

console.log('\n=== Días singular ===\n');
{
    const result = tpl.render({ ...sample, daysLeft: 1 });
    test('dice "1 día"', result.html.includes('1 día') && !result.html.includes('1 días'));
}

console.log('\n=== Sin opcionales ===\n');
{
    const result = tpl.render({
        companyName: 'X',
        cancelledAt: new Date()
    });
    test('sin rnc/owner/plan no rompe', typeof result.html === 'string');
    test('sin owner usa "usuario"', result.html.includes('usuario'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ cancelledAt: new Date() }),
        'companyName is required'
    );
    test('lanza sin companyName', noCompany.ok, noCompany.error);

    const noDate = assertThrows(
        () => tpl.render({ companyName: 'X' }),
        'cancelledAt is required'
    );
    test('lanza sin cancelledAt', noDate.ok, noDate.error);
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