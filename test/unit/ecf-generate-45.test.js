const {
    generateECF45,
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

const validInvoice45 = {
    ncf: 'E450000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    // 45 requiere RNC + RazonSocial obligatorios
    receiverRnc: '401007548',
    receiverName: 'Ministerio de Educación',
    paymentType: 1,
    paymentMethods: [{ method: 1, amount: 1180.00 }],
    issuedAt: new Date('2026-09-27T10:30:00'),
    subtotal: 1000.00,
    itbis: 180.00,
    total: 1180.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    lines: [{
        lineNumber: 1,
        description: 'Servicio gubernamental',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 18,
        itemCode: 'GOV-01'
    }]
};

console.log('=== TESTS: generateECF45 ===\n');
const xml = generateECF45(validInvoice45);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc
test('has TipoeCF 45', xml.includes('<TipoeCF>45</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E450000000001</eNCF>'));
test('has FechaVencimientoSecuencia', xml.includes('<FechaVencimientoSecuencia>'));
test('has TipoIngresos', xml.includes('<TipoIngresos>01</TipoIngresos>'));
test('has IndicadorMontoGravado', xml.includes('<IndicadorMontoGravado>0</IndicadorMontoGravado>'));

// Comprador obligatorio con RNC
test('has Comprador', xml.includes('<Comprador>'));
test('has RNCComprador', xml.includes('<RNCComprador>401007548</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Ministerio de Educación</RazonSocialComprador>'));

// Totales completos (con ITBIS)
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// 45 no tiene retenciones
test('does NOT have TotalITBISRetenido', !xml.includes('<TotalITBISRetenido>'));
test('does NOT have TotalISRRetencion', !xml.includes('<TotalISRRetencion>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 45 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '45');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 45 passes XSD validation', xsdResult.valid);

// Validaciones
console.log('\n=== TESTS: campos obligatorios ===\n');

try {
    generateECF45({ ...validInvoice45, receiverRnc: null });
    test('throws if no receiverRnc', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverRnc', e.message.includes('RNC Comprador is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);