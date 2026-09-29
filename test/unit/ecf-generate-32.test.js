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

// ============================================================
// DATOS DE PRUEBA
// ============================================================

const invoiceData = {
    ncf: 'E320000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',   // ← código de provincia real
    issuerPhone: '809-555-1234', // formato XSD: ddd-ddd-dddd
    issuerEmail: 'juan@barberia.com',
    receiverRnc: null,
    receiverName: 'Cliente Final',
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
            description: 'Corte de cabello',
            quantity: 1,
            unitPrice: 500.00,
            discount: 0,
            itbisRate: 18,
            itemCode: 'SERV-01'
        },
        {
            lineNumber: 2,
            description: 'Tinte',
            quantity: 1,
            unitPrice: 500.00,
            discount: 0,
            itbisRate: 18,
            itemCode: 'SERV-02'
        }
    ]
};

console.log('=== TESTS: generateECF32 ===\n');

const xml = generateECF32(invoiceData);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has closing ECF tag', xml.includes('</ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc
test('has Version 1.0', xml.includes('<Version>1.0</Version>'));
test('has TipoeCF 32', xml.includes('<TipoeCF>32</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E320000000001</eNCF>'));
test('has TipoPago 1', xml.includes('<TipoPago>1</TipoPago>'));
test('has TablaFormasPago', xml.includes('<TablaFormasPago>'));
test('has FormaPago 1', xml.includes('<FormaPago>1</FormaPago>'));
test('has MontoPago', xml.includes('<MontoPago>1180.00</MontoPago>'));
test('does NOT have FechaVencimientoSecuencia (32 no lo lleva)',
    !xml.includes('<FechaVencimientoSecuencia>'));

// Emisor
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RazonSocialEmisor', xml.includes('<RazonSocialEmisor>Juan Pérez</RazonSocialEmisor>'));
test('has NombreComercial', xml.includes('<NombreComercial>Barbería Juan</NombreComercial>'));
test('has Municipio', xml.includes('<Municipio>110100</Municipio>'));
test('has FechaEmision', xml.includes('<FechaEmision>27-09-2026</FechaEmision>'));

// Comprador opcional
test('does NOT have RNCComprador (null)', !xml.includes('<RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Cliente Final</RazonSocialComprador>'));

// Totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// Detalle de items
test('has 2 Item tags', (xml.match(/<Item>/g) || []).length === 2);
test('has NumeroLinea 1', xml.includes('<NumeroLinea>1</NumeroLinea>'));
test('has NumeroLinea 2', xml.includes('<NumeroLinea>2</NumeroLinea>'));
test('has IndicadorFacturacion 1', xml.includes('<IndicadorFacturacion>1</IndicadorFacturacion>'));
test('has CodigoItem', xml.includes('<CodigoItem>SERV-01</CodigoItem>'));

// Orden dentro de Item
const itemMatch = xml.match(/<Item>([\s\S]*?)<\/Item>/);
if (itemMatch) {
    const itemContent = itemMatch[1];
    const idxTablaCodigos = itemContent.indexOf('<TablaCodigosItem>');
    const idxIndicador = itemContent.indexOf('<IndicadorFacturacion>');
    test('TablaCodigosItem before IndicadorFacturacion',
        idxTablaCodigos > 0 && idxTablaCodigos < idxIndicador);
}

// Sin tags vacíos
test('does NOT have empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*><\/[a-zA-Z0-9_:]+>/));
test('does NOT have self-closing empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*\/>/));

// Validación XSD real
console.log('\n=== TESTS: validateAgainstXSD tipo 32 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '32');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 32 passes XSD validation', xsdResult.valid);

// Caso exento (ITBIS 0%)
console.log('\n=== TESTS: generateECF32 con ITBIS 0% (exento) ===\n');
const exemptInvoice = {
    ...invoiceData,
    ncf: 'E320000000002',
    subtotal: 500.00,
    itbis: 0.00,
    total: 500.00,
    itbis1Base: 0,
    itbis1Amount: 0,
    itbis3Base: 500.00,
    lines: [{
        lineNumber: 1,
        description: 'Arroz',
        quantity: 1,
        unitPrice: 500.00,
        discount: 0,
        itbisRate: 0
    }]
};
const xmlExempt = generateECF32(exemptInvoice);
test('has MontoGravadoI3', xmlExempt.includes('<MontoGravadoI3>500.00</MontoGravadoI3>'));
test('has ITBIS3', xmlExempt.includes('<ITBIS3>0</ITBIS3>'));
test('IndicadorFacturacion is 3', xmlExempt.includes('<IndicadorFacturacion>3</IndicadorFacturacion>'));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);