const {
    generateECF32,
    validateAgainstXSD,
    clearXSDCache
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

// XML mínimo válido de tipo 32 usado como caso base de "el validador carga un XSD sin explotar".
const minimalInvoice32 = {
    ncf: 'E320000000001',
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuedAt: new Date('2026-09-27T10:30:00'),
    subtotal: 1000.00,
    itbis: 180.00,
    total: 1180.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    lines: [{
        lineNumber: 1,
        description: 'Servicio',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 18
    }]
};

clearXSDCache();

console.log('=== TESTS: validateAgainstXSD (infraestructura) ===\n');

// ------------------------------------------------------------
// Caso base: el validador carga un XSD y valida un XML correcto
// ------------------------------------------------------------
console.log('--- XML 32 válido (caso base) ---');
const xml32 = generateECF32(minimalInvoice32);
const result32 = validateAgainstXSD(xml32, '32');
test('valid is true', result32.valid === true, JSON.stringify(result32.errors));

// ------------------------------------------------------------
// Fallos esperados del propio validador
// ------------------------------------------------------------
console.log('\n--- XML vacío ---');
const emptyResult = validateAgainstXSD('', '32');
test('valid is false', emptyResult.valid === false);
test('has error', emptyResult.errors.length > 0);

console.log('\n--- Tipo inválido ---');
const invalidTypeResult = validateAgainstXSD(xml32, '99');
test('valid is false', invalidTypeResult.valid === false);

console.log('\n--- Sin declaración XML ---');
const noDeclResult = validateAgainstXSD('<ECF></ECF>', '32');
test('valid is false', noDeclResult.valid === false);

console.log('\n--- XML malformado ---');
const malformedResult = validateAgainstXSD('<ECF><Unclosed></ECF>', '32');
test('valid is false', malformedResult.valid === false);

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);