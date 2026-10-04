// ============================================================
// TEST: notifications.layout (Step 6.2A)
// Ejecutar: node test/unit/notifications_layout.test.js
// ============================================================

const { wrapLayout, escapeHtml, BRAND } = require('../../src/modules/notifications/notifications.layout');
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

console.log('=== notifications.layout — API ===\n');
test('exporta wrapLayout', typeof wrapLayout === 'function');
test('exporta escapeHtml', typeof escapeHtml === 'function');
test('exporta BRAND', typeof BRAND === 'object' && BRAND !== null);

console.log('\n=== BRAND — contrato ===\n');
test('tiene name', typeof BRAND.name === 'string' && BRAND.name.length > 0);
test('tiene logoUrl', BRAND.logoUrl.startsWith('https://'));
test('tiene rnc', typeof BRAND.rnc === 'string' && BRAND.rnc.length > 0);
test('tiene primaryColor', /^#[0-9a-f]{6}$/i.test(BRAND.primaryColor));
test('tiene accentColor', /^#[0-9a-f]{6}$/i.test(BRAND.accentColor));

console.log('\n=== wrapLayout — estructura ===\n');
{
    const html = wrapLayout({
        title: 'Test',
        bodyHtml: '<p>Hola mundo</p>'
    });

    test('empieza con doctype', html.startsWith('<!DOCTYPE html>'));
    test('tiene <html lang="es">', html.includes('<html lang="es">'));
    test('tiene charset UTF-8', html.includes('<meta charset="UTF-8">'));
    test('tiene viewport', html.includes('name="viewport"'));
    test('incluye el bodyHtml', html.includes('<p>Hola mundo</p>'));
    test('incluye el logo', html.includes(BRAND.logoUrl));
    test('incluye el RNC en footer', html.includes(BRAND.rnc));
    test('incluye el <title>', html.includes('<title>Test</title>'));
    test('contiene la palabra "automático" (footer)', html.includes('automático'));
    test('tiene max-width 600 (responsive)', html.includes('max-width:600px'));
    test('usa tablas (email-safe)', html.includes('role="presentation"'));
}

console.log('\n=== escapeHtml ===\n');
test('escapa < > & " \'', escapeHtml('<a href="x">\'&') === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
test('null → ""', escapeHtml(null) === '');
test('undefined → ""', escapeHtml(undefined) === '');
test('number → string', escapeHtml(42) === '42');

console.log('\n=== title escapado ===\n');
{
    const html = wrapLayout({
        title: '<script>alert(1)</script>',
        bodyHtml: '<p>x</p>'
    });
    test('escapa el <title>', html.includes('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>'));
    test('NO contiene <script>', !html.includes('<script>'));
}

// ------------------------------------------------------------
// Extra: el layout respeta el branding de constants/brand.js
// ------------------------------------------------------------
console.log('\n=== Integración con constants/brand.js ===\n');
{
    const brandFromConstants = require('../../src/constants/brand');

    test('layout re-exporta el mismo BRAND que constants',
        BRAND === brandFromConstants);

    const html = wrapLayout({ title: 'X', bodyHtml: '<p>x</p>' });
    test('html contiene el logoUrl del brand', html.includes(brandFromConstants.logoUrl));
    test('html contiene el RNC del brand', html.includes(brandFromConstants.rnc));
    test('html contiene el nombre del brand', html.includes(brandFromConstants.name));
    test('html contiene los colores del brand',
        html.includes(brandFromConstants.primaryColor) &&
        html.includes(brandFromConstants.accentColor));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

