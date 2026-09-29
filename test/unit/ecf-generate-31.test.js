const {
    generateECF31,
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

// ============================================================
// DATOS DE PRUEBA para e-CF 31 (Crédito Fiscal)
// ============================================================

const validInvoice31 = {
    ncf: 'E310000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',   // ← código de provincia real (6 dígitos)
    receiverRnc: '130999888',
    receiverName: 'Empresa Compradora SRL',
    paymentType: 1,
    paymentMethods: [{ method: 1, amount: 1180.00 }],
    issuedAt: new Date('2026-09-27T10:30:00'),
    subtotal: 1000.00,
    itbis: 180.00,
    total: 1180.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    lines: [
        {
            lineNumber: 1,
            description: 'Servicio profesional',
            quantity: 1,
            unitPrice: 1000.00,
            discount: 0,
            itbisRate: 18,
            itemCode: 'SERV-01'
        }
    ]
};

console.log('=== TESTS: generateECF31 ===\n');

const xml = generateECF31(validInvoice31);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has TipoeCF 31', xml.includes('<TipoeCF>31</TipoeCF>'));
test('has eNCF with E31', xml.includes('<eNCF>E310000000001</eNCF>'));
test('has ECF root', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// Comprador obligatorio
test('has RNCComprador', xml.includes('<RNCComprador>130999888</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Empresa Compradora SRL</RazonSocialComprador>'));

// Totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// Orden dentro de Item (validación explícita)
const itemMatch = xml.match(/<Item>([\s\S]*?)<\/Item>/);
if (itemMatch) {
    const itemContent = itemMatch[1];
    const idxTablaCodigos = itemContent.indexOf('<TablaCodigosItem>');
    const idxIndicador = itemContent.indexOf('<IndicadorFacturacion>');
    test('TablaCodigosItem before IndicadorFacturacion', 
        idxTablaCodigos > 0 && idxTablaCodigos < idxIndicador);
} else {
    test('has an <Item> block', false);
}

// Validación XSD real
console.log('\n=== TESTS: validateAgainstXSD tipo 31 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '31');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 31 passes XSD validation', xsdResult.valid);

// Validación de comprador obligatorio
console.log('\n=== TESTS: validación de comprador obligatorio ===\n');

try {
    generateECF31({ ...validInvoice31, receiverRnc: null });
    test('throws if no receiverRnc', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverRnc', e.message.includes('RNC Comprador is required'));
}

try {
    generateECF31({ ...validInvoice31, receiverName: null });
    test('throws if no receiverName', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverName', e.message.includes('Razón Social Comprador is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);