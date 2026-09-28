const {
    generateECF32,
    generateECF31,
    validateAgainstXSD
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

// ------------------------------------------------------------
// Factura 32 válida
// ------------------------------------------------------------
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
            description: 'Corte',
            quantity: 1,
            unitPrice: 1000.00,
            discount: 0,
            itbisRate: 18
        }
    ]
};

// ------------------------------------------------------------
// Factura 31 válida
// ------------------------------------------------------------
const validInvoice31 = {
    ...validInvoice32,
    ncf: 'E310000000001',
    receiverRnc: '130999888',
    receiverName: 'Empresa Compradora SRL'
};

console.log('=== TESTS: validateAgainstXSD ===\n');

// ------------------------------------------------------------
// Validación de XML válido (tipo 32)
// ------------------------------------------------------------
console.log('--- XML 32 válido ---');
const xml32 = generateECF32(validInvoice32);
const result32 = validateAgainstXSD(xml32, '32');
test('valid is true', result32.valid === true);
test('no errors', result32.errors.length === 0, `errors: ${JSON.stringify(result32.errors)}`);

// ------------------------------------------------------------
// Validación de XML válido (tipo 31)
// ------------------------------------------------------------
console.log('\n--- XML 31 válido ---');
const xml31 = generateECF31(validInvoice31);
const result31 = validateAgainstXSD(xml31, '31');
test('valid is true', result31.valid === true);
test('no errors', result31.errors.length === 0);

// ------------------------------------------------------------
// Validación falla: XML vacío
// ------------------------------------------------------------
console.log('\n--- XML vacío ---');
const emptyResult = validateAgainstXSD('', '32');
test('valid is false', emptyResult.valid === false);
test('has error about empty', emptyResult.errors.some(e => e.includes('empty')));

// ------------------------------------------------------------
// Validación falla: tipo inválido
// ------------------------------------------------------------
console.log('\n--- Tipo inválido ---');
const invalidTypeResult = validateAgainstXSD(xml32, '99');
test('valid is false', invalidTypeResult.valid === false);
test('has error about invalid type', invalidTypeResult.errors.some(e => e.includes('Invalid e-CF type')));

// ------------------------------------------------------------
// Validación falla: tipo no coincide
// ------------------------------------------------------------
console.log('\n--- Tipo no coincide ---');
const mismatchResult = validateAgainstXSD(xml32, '31');
test('valid is false', mismatchResult.valid === false);
test('has error about mismatch', mismatchResult.errors.some(e => e.includes('does not match')));

// ------------------------------------------------------------
// Validación falla: XML sin declaración
// ------------------------------------------------------------
console.log('\n--- Sin declaración XML ---');
const noDeclResult = validateAgainstXSD('<ECF></ECF>', '32');
test('valid is false', noDeclResult.valid === false);
test('has error about declaration', noDeclResult.errors.some(e => e.includes('declaration')));

// ------------------------------------------------------------
// Validación falla: XML con tag vacío
// ------------------------------------------------------------
console.log('\n--- Con tag vacío ---');
const emptyTagXml = xml32.replace('</FechaHoraFirma>', '<Test></Test></FechaHoraFirma>');
const emptyTagResult = validateAgainstXSD(emptyTagXml, '32');
test('valid is false', emptyTagResult.valid === false);
test('has error about empty tags', emptyTagResult.errors.some(e => e.includes('empty tags')));

// ------------------------------------------------------------
// Validación falla: falta tag obligatorio
// ------------------------------------------------------------
console.log('\n--- Falta tag obligatorio ---');
const missingTagXml = xml32.replace(/<MontoTotal>.*?<\/MontoTotal>/, '');
const missingTagResult = validateAgainstXSD(missingTagXml, '32');
test('valid is false', missingTagResult.valid === false);
test('has error about MontoTotal', missingTagResult.errors.some(e => e.includes('MontoTotal')));

// ------------------------------------------------------------
// Validación falla: 31 sin RNCComprador
// ------------------------------------------------------------
console.log('\n--- 31 sin RNCComprador ---');
// Simulamos un XML 31 sin comprador (editando el string)
const xml31NoReceiver = xml31.replace(/<RNCComprador>.*?<\/RNCComprador>/, '');
const noReceiverResult = validateAgainstXSD(xml31NoReceiver, '31');
test('valid is false', noReceiverResult.valid === false);
test('has error about RNCComprador', noReceiverResult.errors.some(e => e.includes('RNCComprador')));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);