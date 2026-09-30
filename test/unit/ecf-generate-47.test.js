const {
    generateECF47,
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

const validInvoice47 = {
    ncf: 'E470000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    // 47 Comprador solo con IdentificadorExtranjero
    receiverIdentificadorExtranjero: 'US-98765432',
    receiverName: 'Foreign Service Provider',
    paymentType: 1,
    issuedAt: new Date('2026-09-27T10:30:00'),
    // 47 solo MontoExento
    total: 1000.00,
    exemptAmount: 1000.00,
    // Transporte reducido (solo PaisDestino)
    transporte: {
        paisDestino: 'Estados Unidos'
    },
    lines: [{
        lineNumber: 1,
        description: 'Servicio del exterior',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 0,
        itemCode: 'EXT-01',
        // 47 requiere Retencion obligatoria con MontoISRRetenido
        retencion: {
            indicador: 1,               // 1 = Retención
            montoIsrRetenido: 270.00
        }
    }]
};

console.log('=== TESTS: generateECF47 ===\n');
const xml = generateECF47(validInvoice47);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — 47 sin TipoIngresos, sin IndicadorEnvioDiferido, sin IndicadorMontoGravado
test('has TipoeCF 47', xml.includes('<TipoeCF>47</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E470000000001</eNCF>'));
test('has FechaVencimientoSecuencia', xml.includes('<FechaVencimientoSecuencia>'));
test('does NOT have TipoIngresos (47 no lo lleva)', !xml.includes('<TipoIngresos>'));
test('does NOT have IndicadorMontoGravado (47 no lo lleva)', !xml.includes('<IndicadorMontoGravado>'));
test('does NOT have IndicadorEnvioDiferido (47 no lo lleva)', !xml.includes('<IndicadorEnvioDiferido>'));

// Comprador — solo IdentificadorExtranjero
test('has Comprador', xml.includes('<Comprador>'));
test('has IdentificadorExtranjero', xml.includes('<IdentificadorExtranjero>US-98765432</IdentificadorExtranjero>'));
test('does NOT have RNCComprador (47 no lo lleva)', !xml.includes('<RNCComprador>'));

// Transporte reducido
test('has Transporte', xml.includes('<Transporte>'));
test('has PaisDestino', xml.includes('<PaisDestino>Estados Unidos</PaisDestino>'));
test('does NOT have ViaTransporte (47 transporte reducido)', !xml.includes('<ViaTransporte>'));

// Retencion obligatoria por línea
test('has Retencion block in Item', xml.includes('<Retencion>'));
test('has IndicadorAgenteRetencionoPercepcion', xml.includes('<IndicadorAgenteRetencionoPercepcion>1</IndicadorAgenteRetencionoPercepcion>'));
test('has MontoISRRetenido', xml.includes('<MontoISRRetenido>270.00</MontoISRRetenido>'));

// Totales — 47 solo MontoExento
test('has MontoExento', xml.includes('<MontoExento>1000.00</MontoExento>'));
test('has MontoTotal', xml.includes('<MontoTotal>1000.00</MontoTotal>'));
test('does NOT have ITBIS1', !xml.includes('<ITBIS1>'));
test('does NOT have TotalITBIS', !xml.includes('<TotalITBIS>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 47 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '47');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 47 passes XSD validation', xsdResult.valid);

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);