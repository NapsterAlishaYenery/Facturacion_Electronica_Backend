// ============================================================
// TEST: templates/password-reset (Step 6.6c)
// Ejecutar: node test/unit/notifications_password_reset.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/password-reset');
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

console.log('=== password-reset — API ===\n');
test('exporta subject', typeof tpl.subject === 'string' && tpl.subject.length > 0);
test('exporta render', typeof tpl.render === 'function');
test('subject correcto', tpl.subject === 'Tu contraseña fue restablecida');

console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        name: 'Juan',
        when: new Date('2026-10-04T15:30:00'),
        ip: '190.80.20.5'
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('html contiene el nombre', result.html.includes('Juan'));
    test('html contiene la fecha formateada',
        result.html.includes('2026') && result.html.includes('octubre'));
    test('html contiene la IP', result.html.includes('190.80.20.5'));
    test('text contiene la IP', result.text.includes('190.80.20.5'));
    test('html tiene aviso "No reconoces este cambio"',
        result.html.includes('No reconoces este cambio'));
    test('text advierte "Si NO reconoces este cambio"',
        result.text.includes('Si NO reconoces este cambio'));
    test('html menciona que puede estar comprometida',
        result.html.toLowerCase().includes('comprometida'));
}

console.log('\n=== Sin nombre ===\n');
{
    const result = tpl.render({ ip: '1.2.3.4' });
    test('usa "usuario" por defecto', result.html.includes('usuario'));
}

console.log('\n=== Sin IP (opcional) ===\n');
{
    const result = tpl.render({ name: 'Ana' });
    test('sin IP no rompe', typeof result.html === 'string');
    test('sin IP no aparece fila "IP:"',
        !result.html.includes('IP:') || !result.text.includes('IP:'));
}

console.log('\n=== Sin argumentos (todo default) ===\n');
{
    const result = tpl.render();
    test('no rompe sin argumentos', typeof result.html === 'string');
    test('usa "usuario" por defecto', result.html.includes('usuario'));
    test('usa fecha actual si no se pasa', result.html.includes('2026'));
}

console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        name: '<script>alert(1)</script>',
        ip: '<img src=x onerror=y>'
    });
    test('escapa <script> en nombre', !result.html.includes('<script>'));
    test('escapa <img> en IP',
        !result.html.includes('<img src=x onerror=y>'));
    test('contiene la versión escapada', result.html.includes('&lt;script&gt;'));
}

console.log('\n=== Layout integrado ===\n');
{
    const result = tpl.render({ name: 'X' });
    test('incluye logo', result.html.includes(BRAND.logoUrl));
    test('incluye RNC footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);