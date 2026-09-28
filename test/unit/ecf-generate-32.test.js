const { generateECF32 } = require('../../src/modules/invoices/ecf/xml-generator');

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
    issuerProvincia: '11',
    issuerPhone: '8095551234',
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

// Validaciones estructurales
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

// Emisor
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RazonSocialEmisor', xml.includes('<RazonSocialEmisor>Juan Pérez</RazonSocialEmisor>'));
test('has NombreComercial', xml.includes('<NombreComercial>Barbería Juan</NombreComercial>'));
test('has DireccionEmisor', xml.includes('<DireccionEmisor>Calle Duarte #45, Higüey</DireccionEmisor>'));
test('has Municipio', xml.includes('<Municipio>110100</Municipio>'));
test('has Provincia', xml.includes('<Provincia>11</Provincia>'));
test('has TelefonoEmisor', xml.includes('<TelefonoEmisor>8095551234</TelefonoEmisor>'));
test('has CorreoEmisor', xml.includes('<CorreoEmisor>juan@barberia.com</CorreoEmisor>'));
test('has FechaEmision', xml.includes('<FechaEmision>27-09-2026</FechaEmision>'));

// Comprador (opcional en FC < 250K)
test('does NOT have RNCComprador (null)', !xml.includes('<RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Cliente Final</RazonSocialComprador>'));

// Totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has MontoGravadoI1', xml.includes('<MontoGravadoI1>1000.00</MontoGravadoI1>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has TotalITBIS1', xml.includes('<TotalITBIS1>180.00</TotalITBIS1>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// Detalles de items
test('has 2 Item tags', (xml.match(/<Item>/g) || []).length === 2);
test('has first Item', xml.includes('<NombreItem>Corte de cabello</NombreItem>'));
test('has second Item', xml.includes('<NombreItem>Tinte</NombreItem>'));
test('has NumeroLinea 1', xml.includes('<NumeroLinea>1</NumeroLinea>'));
test('has NumeroLinea 2', xml.includes('<NumeroLinea>2</NumeroLinea>'));
test('has IndicadorFacturacion 1', xml.includes('<IndicadorFacturacion>1</IndicadorFacturacion>'));
test('has IndicadorBienoServicio 2', xml.includes('<IndicadorBienoServicio>2</IndicadorBienoServicio>'));
test('has PrecioUnitarioItem', xml.includes('<PrecioUnitarioItem>500.00</PrecioUnitarioItem>'));
test('has MontoItem', xml.includes('<MontoItem>500.00</MontoItem>'));
test('has CodigoItem', xml.includes('<CodigoItem>SERV-01</CodigoItem>'));

// No debe tener tags vacíos
test('does NOT have empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*><\/[a-zA-Z0-9_:]+>/));
test('does NOT have self-closing empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*\/>/));

// ============================================================
// TEST con ITBIS 0% (exento)
// ============================================================

const exemptInvoice = {
    ...invoiceData,
    subtotal: 500.00,
    itbis: 0.00,
    total: 500.00,
    itbis1Base: 0,
    itbis1Amount: 0,
    itbis3Base: 500.00,
    lines: [
        {
            lineNumber: 1,
            description: 'Arroz',
            quantity: 1,
            unitPrice: 500.00,
            discount: 0,
            itbisRate: 0
        }
    ]
};

const xmlExempt = generateECF32(exemptInvoice);

test('has MontoGravadoI3', xmlExempt.includes('<MontoGravadoI3>500.00</MontoGravadoI3>'));
test('has ITBIS3', xmlExempt.includes('<ITBIS3>0</ITBIS3>'));
test('IndicadorFacturacion is 3', xmlExempt.includes('<IndicadorFacturacion>3</IndicadorFacturacion>'));

// ============================================================
// TEST con ITBIS 16%
// ============================================================
console.log('\n=== TESTS: generateECF32 con ITBIS 16% ===\n');

const mixedInvoice = {
    ...invoiceData,
    subtotal: 1500.00,
    itbis: 260.00,
    total: 1760.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    itbis2Base: 500.00,
    itbis2Amount: 80.00,
    lines: [
        {
            lineNumber: 1,
            description: 'Producto 18%',
            quantity: 1,
            unitPrice: 1000.00,
            discount: 0,
            itbisRate: 18
        },
        {
            lineNumber: 2,
            description: 'Producto 16%',
            quantity: 1,
            unitPrice: 500.00,
            discount: 0,
            itbisRate: 16
        }
    ]
};

const xmlMixed = generateECF32(mixedInvoice);

test('has MontoGravadoI2', xmlMixed.includes('<MontoGravadoI2>500.00</MontoGravadoI2>'));
test('has ITBIS2', xmlMixed.includes('<ITBIS2>16</ITBIS2>'));
test('has TotalITBIS2', xmlMixed.includes('<TotalITBIS2>80.00</TotalITBIS2>'));
test('IndicadorFacturacion 1 and 2', 
    xmlMixed.includes('<IndicadorFacturacion>1</IndicadorFacturacion>') &&
    xmlMixed.includes('<IndicadorFacturacion>2</IndicadorFacturacion>'));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);

