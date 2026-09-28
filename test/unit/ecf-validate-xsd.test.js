const {
    generateECF32,
    generateECF31,
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

// ============================================================
// Datos de prueba válidos
// ============================================================

const validInvoice32 = {
    ncf: 'E320000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuedAt: new Date('2026-09-27T10:30:00'),
    subtotal: 1000.00,
    itbis: 180.00,
    total: 1180.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    lines: [
        {
            lineNumber: 1,
            description: 'Corte de cabello',
            quantity: 1,
            unitPrice: 1000.00,
            discount: 0,
            itbisRate: 18
        }
    ]
};

const validInvoice31 = {
    ...validInvoice32,
    ncf: 'E310000000001',
    receiverRnc: '130999888',
    receiverName: 'Empresa Compradora SRL'
};

clearXSDCache();

// ============================================================
// TESTS
// ============================================================

console.log('=== TESTS: validateAgainstXSD (real) ===\n');

// ------------------------------------------------------------
// XML 32 válido
// ------------------------------------------------------------
console.log('--- XML 32 válido ---');
const xml32 = generateECF32(validInvoice32);
const result32 = validateAgainstXSD(xml32, '32');
console.log('   Valid:', result32.valid);
if (!result32.valid) {
    console.log('   Errors:', JSON.stringify(result32.errors, null, 2));
}
test('valid is true', result32.valid === true);

// ------------------------------------------------------------
// XML 31 válido
// ------------------------------------------------------------
console.log('\n--- XML 31 válido ---');
const xml31 = generateECF31(validInvoice31);
const result31 = validateAgainstXSD(xml31, '31');
console.log('   Valid:', result31.valid);
if (!result31.valid) {
    console.log('   Errors:', JSON.stringify(result31.errors, null, 2));
}
test('valid is true', result31.valid === true);

// ------------------------------------------------------------
// Fallos esperados
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

