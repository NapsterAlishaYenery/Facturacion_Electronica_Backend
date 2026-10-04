// ============================================================
// TEST: templates/new-company-alert (Step 6.6b)
// Ejecutar: node test/unit/notifications_new_company_alert.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/new-company-alert');

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

console.log('=== new-company-alert — API ===\n');
test('exporta subject', typeof tpl.subject === 'string');
test('exporta render', typeof tpl.render === 'function');
test('exporta buildSubject', typeof tpl.buildSubject === 'function');

console.log('\n=== buildSubject — dinámico ===\n');
{
    const s = tpl.buildSubject({ company: { name: 'Barbería Juan' } });
    test('subject incluye nombre empresa', s.includes('Barbería Juan'));
    test('subject tiene prefijo 🚀', s.includes('🚀'));
}

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        company: {
            name: 'Barbería Juan SRL',
            rnc: '130999888',
            email: 'info@barberia.com',
            phone: '+1 809 555 0000',
            address: 'Calle Duarte #45',
            economicActivity: 'Servicios de barbería',
            dgiiEnvironment: 'testecf'
        },
        owner: {
            firstName: 'Juan',
            middleName: null,
            lastName: 'Pérez',
            secondLastName: 'Gómez',
            email: 'juan@barberia.com',
            role: 'company_admin'
        },
        subscription: {
            status: 'trial',
            trialEndsAt: new Date('2026-10-30T00:00:00')
        },
        plan: { name: 'Plan Básico' },
        meta: { ip: '190.80.20.5', userAgent: 'Mozilla/5.0' }
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene nombre empresa', result.html.includes('Barbería Juan SRL'));
    test('html contiene RNC', result.html.includes('130999888'));
    test('html contiene nombre del dueño', result.html.includes('Juan Pérez Gómez'));
    test('html contiene email del dueño', result.html.includes('juan@barberia.com'));
    test('html contiene plan', result.html.includes('Plan Básico'));
    test('html contiene estado', result.html.includes('trial'));
    test('html contiene la IP', result.html.includes('190.80.20.5'));
    test('text tiene estructura plana', result.text.includes('NUEVA EMPRESA REGISTRADA'));
    test('text contiene dueño', result.text.includes('juan@barberia.com'));
}

console.log('\n=== Validaciones ===\n');
{
    const noCompany = assertThrows(
        () => tpl.render({ owner: {} }),
        'company is required'
    );
    test('lanza sin company', noCompany.ok, noCompany.error);

    const noOwner = assertThrows(
        () => tpl.render({ company: {} }),
        'owner is required'
    );
    test('lanza sin owner', noOwner.ok, noOwner.error);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);