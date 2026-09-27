// Tests unitarios para las utilidades del generador de XML
// No necesita BD ni server. Solo Node.js.

const {
    escapeXMLSpecialChars,
    removeEmptyTags
} = require('../../src/modules/invoices/ecf/xml-generator');

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

console.log('=== TESTS: escapeXMLSpecialChars ===\n');

// Casos básicos
test('escape &', escapeXMLSpecialChars('AT&T') === 'AT&amp;T');
test('escape <', escapeXMLSpecialChars('5 < 10') === '5 &lt; 10');
test('escape >', escapeXMLSpecialChars('10 > 5') === '10 &gt; 5');
test('escape "', escapeXMLSpecialChars('dijo "hola"') === 'dijo &quot;hola&quot;');
test("escape '", escapeXMLSpecialChars("it's") === 'it&apos;s');

// No debe doble-escapar
test('no double-escape &', escapeXMLSpecialChars('&amp;') === '&amp;amp;');

// Null y undefined
test('null returns empty', escapeXMLSpecialChars(null) === '');
test('undefined returns empty', escapeXMLSpecialChars(undefined) === '');

// Números
test('number to string', escapeXMLSpecialChars(123) === '123');
test('zero to string', escapeXMLSpecialChars(0) === '0');

// Combinaciones
test('multiple special chars', 
    escapeXMLSpecialChars('<tag>&"\'</tag>') === '&lt;tag&gt;&amp;&quot;&apos;&lt;/tag&gt;');

// Texto plano
test('plain text unchanged', escapeXMLSpecialChars('Hello World') === 'Hello World');

// Acentos (no se escapan, son válidos en XML UTF-8)
test('accents unchanged', escapeXMLSpecialChars('Café López') === 'Café López');
test('ñ unchanged', escapeXMLSpecialChars('España') === 'España');

console.log('\n=== TESTS: removeEmptyTags ===\n');

// Tags vacíos simples
test('remove empty tag', 
    removeEmptyTags('<root><a></a><b>text</b></root>') === '<root><b>text</b></root>');

test('remove self-closing tag', 
    removeEmptyTags('<root><a/><b>text</b></root>') === '<root><b>text</b></root>');

test('remove tag with whitespace', 
    removeEmptyTags('<root><a>   </a><b>text</b></root>') === '<root><b>text</b></root>');

// Cascada: eliminar un hijo vacío deja al padre vacío
test('cascade empty parents', 
    removeEmptyTags('<root><parent><child></child></parent><b>text</b></root>') === '<root><b>text</b></root>');

// Tags con atributos
test('remove empty tag with attributes', 
    removeEmptyTags('<root><a id="1"></a><b>text</b></root>') === '<root><b>text</b></root>');

// No eliminar tags con contenido
test('keep tag with content', 
    removeEmptyTags('<root><a>hello</a></root>') === '<root><a>hello</a></root>');

// No eliminar tags con solo números
test('keep numeric content', 
    removeEmptyTags('<root><a>0</a></root>') === '<root><a>0</a></root>');

// XML sin tags vacíos
test('no changes if no empty tags', 
    removeEmptyTags('<root><a>1</a><b>2</b></root>') === '<root><a>1</a><b>2</b></root>');

// Input vacío o inválido
test('empty string returns empty', removeEmptyTags('') === '');
test('null returns null', removeEmptyTags(null) === null);
test('undefined returns undefined', removeEmptyTags(undefined) === undefined);

// Múltiples tags vacíos consecutivos
test('multiple empty tags', 
    removeEmptyTags('<root><a></a><b></b><c>text</c><d/></root>') === '<root><c>text</c></root>');

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);