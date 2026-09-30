const {
    generateECF46,
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

const validInvoice46 = {
    ncf: 'E460000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Exportadora Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    // 46 requiere RazonSocial pero no RNC
    receiverName: 'International Buyer LLC',
    receiverIdentificadorExtranjero: 'US-12345678',
    paymentType: 1,
    issuedAt: new Date('2026-09-27T10:30:00'),
    // 46 solo ITBIS3 (exportación tasa 0)
    total: 1000.00,
    itbis3Base: 1000.00,
    // Bloque Transporte extendido
    transporte: {
        viaTransporte: '02',       // 02 = Marítimo
        paisOrigen: 'República Dominicana',
        direccionDestino: '123 Main St, Miami, FL',
        paisDestino: 'Estados Unidos',
        rncCompaniaTransportista: '101010101',
        nombreCompaniaTransportista: 'Ocean Freight Co.',
        numeroViaje: 'VY-2026-001'
    },
    lines: [{
        lineNumber: 1,
        description: 'Producto de exportación',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 0,
        itemCode: 'EXP-01'
    }]
};

console.log('=== TESTS: generateECF46 ===\n');
const xml = generateECF46(validInvoice46);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc
test('has TipoeCF 46', xml.includes('<TipoeCF>46</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E460000000001</eNCF>'));
test('has TipoIngresos', xml.includes('<TipoIngresos>01</TipoIngresos>'));
test('does NOT have IndicadorMontoGravado (46 no lo lleva)', !xml.includes('<IndicadorMontoGravado>'));

// Comprador
test('has Comprador', xml.includes('<Comprador>'));
test('has IdentificadorExtranjero', xml.includes('<IdentificadorExtranjero>US-12345678</IdentificadorExtranjero>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>International Buyer LLC</RazonSocialComprador>'));

// Transporte extendido
test('has Transporte', xml.includes('<Transporte>'));
test('has ViaTransporte', xml.includes('<ViaTransporte>02</ViaTransporte>'));
test('has PaisOrigen', xml.includes('<PaisOrigen>República Dominicana</PaisOrigen>'));
test('has PaisDestino', xml.includes('<PaisDestino>Estados Unidos</PaisDestino>'));
test('has RNCIdentificacionCompaniaTransportista', xml.includes('<RNCIdentificacionCompaniaTransportista>101010101</RNCIdentificacionCompaniaTransportista>'));
test('has NombreCompaniaTransportista', xml.includes('<NombreCompaniaTransportista>Ocean Freight Co.</NombreCompaniaTransportista>'));
test('has NumeroViaje', xml.includes('<NumeroViaje>VY-2026-001</NumeroViaje>'));

// Totales — 46 solo ITBIS3
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has MontoGravadoI3', xml.includes('<MontoGravadoI3>1000.00</MontoGravadoI3>'));
test('has ITBIS3', xml.includes('<ITBIS3>0</ITBIS3>'));
test('does NOT have ITBIS1', !xml.includes('<ITBIS1>'));
test('does NOT have MontoGravadoI1', !xml.includes('<MontoGravadoI1>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 46 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '46');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 46 passes XSD validation', xsdResult.valid);

// Validaciones
console.log('\n=== TESTS: campos obligatorios ===\n');

try {
    generateECF46({ ...validInvoice46, receiverName: null });
    test('throws if no receiverName', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverName', e.message.includes('Razón Social Comprador is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);