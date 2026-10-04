// ============================================================
// TEST: templates/password-reset-code (Step 6.2B)
// Ejecutar: node test/unit/notifications_password_reset_code.test.js
// ============================================================

const tpl = require('../../src/modules/notifications/templates/password-reset-code');
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

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------
console.log('=== password-reset-code — API ===\n');
test('exporta subject', typeof tpl.subject === 'string' && tpl.subject.length > 0);
test('exporta render', typeof tpl.render === 'function');
test('subject correcto', tpl.subject === 'Código de recuperación de contraseña');

// ------------------------------------------------------------
// Happy path
// ------------------------------------------------------------
console.log('\n=== Happy path ===\n');
{
    const result = tpl.render({
        name: 'Juan',
        code: '123456',
        expiresInMinutes: 15
    });

    test('devuelve { html, text }',
        typeof result.html === 'string' && typeof result.text === 'string');
    test('NO devuelve subject (vive en el export)',
        result.subject === undefined);
    test('html contiene el código', result.html.includes('123456'));
    test('html contiene el nombre', result.html.includes('Juan'));
    test('html contiene la duración', result.html.includes('15'));
    test('text contiene el código', result.text.includes('123456'));
    test('text contiene el nombre', result.text.includes('Juan'));
    test('text contiene la duración', result.text.includes('15'));
}

// ------------------------------------------------------------
// Sin nombre (usa "usuario" por defecto)
// ------------------------------------------------------------
console.log('\n=== Sin nombre ===\n');
{
    const result = tpl.render({ code: '999999' });
    test('html contiene "usuario" por defecto', result.html.includes('usuario'));
    test('text contiene "usuario" por defecto', result.text.includes('usuario'));
}

// ------------------------------------------------------------
// Aviso de seguridad
// ------------------------------------------------------------
console.log('\n=== Avisos de seguridad ===\n');
{
    const result = tpl.render({ code: '111111' });

    test('html advierte "Nunca compartas"',
        result.html.toLowerCase().includes('nunca compartas'));
    test('html menciona Expedinap Tech en el aviso',
        result.html.includes(BRAND.name));
    test('text advierte "NUNCA compartas"',
        result.text.includes('NUNCA compartas'));
    test('html avisa "Si no solicitaste"',
        result.html.includes('Si no solicitaste'));
    test('text avisa "Si no solicitaste"',
        result.text.includes('Si no solicitaste'));
}

// ------------------------------------------------------------
// Firma
// ------------------------------------------------------------
console.log('\n=== Firma ===\n');
{
    const result = tpl.render({ code: '222222' });
    test('html tiene firma de Expedinap Tech',
        result.html.includes(`El equipo de ${BRAND.name}`));
    test('text tiene firma de Expedinap Tech',
        result.text.includes(`El equipo de ${BRAND.name}`));
}

// ------------------------------------------------------------
// Duración por defecto
// ------------------------------------------------------------
console.log('\n=== Duración por defecto ===\n');
{
    const result = tpl.render({ code: '333333' });
    test('usa 15 minutos por defecto',
        result.html.includes('15 minutos') || result.text.includes('15 minutos'));
}

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------
console.log('\n=== Validaciones ===\n');
{
    const noCode = assertThrows(
        () => tpl.render({ name: 'X' }),
        'code is required'
    );
    test('lanza si falta code', noCode.ok, noCode.error);
}

// ------------------------------------------------------------
// Escape XSS
// ------------------------------------------------------------
console.log('\n=== Escape XSS ===\n');
{
    const result = tpl.render({
        name: '<script>alert(1)</script>',
        code: '444444'
    });
    test('escapa <script> en el nombre', !result.html.includes('<script>'));
    test('contiene la versión escapada', result.html.includes('&lt;script&gt;'));
}

// ------------------------------------------------------------
// Layout integrado (logo, RNC, doctype)
// ------------------------------------------------------------
console.log('\n=== Layout integrado ===\n');
{
    const result = tpl.render({ code: '555555' });
    test('incluye el logo de Expedinap', result.html.includes(BRAND.logoUrl));
    test('incluye el RNC en footer', result.html.includes(BRAND.rnc));
    test('empieza con doctype', result.html.startsWith('<!DOCTYPE html>'));
}

// ------------------------------------------------------------
// Resultado
// ------------------------------------------------------------
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);