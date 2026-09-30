const {
    generateECF41,
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

const validInvoice41 = {
    ncf: 'E410000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    receiverRnc: '130999888',
    receiverName: 'Proveedor SRL',
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
        description: 'Compra de mercancía',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 18,
        itemCode: 'PROD-01',
        // 41 requiere Retencion obligatoria por línea
        retencion: {
            indicador: 1,               // 1 = Retención
            montoItbisRetenido: 180.00,
            montoIsrRetenido: 0
        }
    }]
};

console.log('=== TESTS: generateECF41 ===\n');
const xml = generateECF41(validInvoice41);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — 41 NO tiene TipoIngresos ni IndicadorEnvioDiferido
test('has TipoeCF 41', xml.includes('<TipoeCF>41</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E410000000001</eNCF>'));
test('has FechaVencimientoSecuencia', xml.includes('<FechaVencimientoSecuencia>'));
test('does NOT have TipoIngresos (41 no lo lleva)', !xml.includes('<TipoIngresos>'));
test('does NOT have IndicadorEnvioDiferido (41 no lo lleva)', !xml.includes('<IndicadorEnvioDiferido>'));
test('does NOT have IndicadorServicioTodoIncluido (41 no lo lleva)', !xml.includes('<IndicadorServicioTodoIncluido>'));

// Emisor / Comprador
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RNCComprador', xml.includes('<RNCComprador>130999888</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Proveedor SRL</RazonSocialComprador>'));

// 41 no tiene CodigoVendedor
test('does NOT have CodigoVendedor (41 no lo lleva)', !xml.includes('<CodigoVendedor>'));

// Retencion obligatoria por línea
test('has Retencion block in Item', xml.includes('<Retencion>'));
test('has IndicadorAgenteRetencionoPercepcion', xml.includes('<IndicadorAgenteRetencionoPercepcion>1</IndicadorAgenteRetencionoPercepcion>'));
test('has MontoITBISRetenido', xml.includes('<MontoITBISRetenido>180.00</MontoITBISRetenido>'));

// Totales — 41 SÍ tiene ITBIS pero NO impuestos adicionales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));
test('does NOT have ImpuestosAdicionales (41 no lo lleva)', !xml.includes('<ImpuestosAdicionales>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 41 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '41');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 41 passes XSD validation', xsdResult.valid);

// Validaciones
console.log('\n=== TESTS: campos obligatorios ===\n');

try {
    generateECF41({ ...validInvoice41, receiverRnc: null });
    test('throws if no receiverRnc', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverRnc', e.message.includes('RNC Comprador is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);