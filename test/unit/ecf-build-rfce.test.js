// test/unit/ecf-build-rfce.test.js
const { buildRFCE } = require('../../src/modules/invoices/ecf/xml-generator');

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

console.log('=== TESTS: buildRFCE (una factura 32 <250K) ===\n');

// --- Caso 1: factura simple con ITBIS 18% ---
const invoiceData = {
    ncf: 'E320000000001',
    tipoIngresos: '01',
    tipoPago: 1,
    paymentMethods: [{ method: 1, amount: 1180.00 }],

    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuedAt: new Date('2026-09-05'),

    itbis1Base: 1000.00,
    itbis1Amount: 180.00,
    total: 1180.00,
};

const xml = buildRFCE(invoiceData, 'ABC123');
console.log('   XML length:', xml.length, 'chars\n');

// Estructura raíz
test('has XML declaration utf-8', xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
test('has RFCE root', xml.includes('<RFCE>'));
test('has closing RFCE', xml.includes('</RFCE>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('does NOT have DetalleECF', !xml.includes('<DetalleECF>'));
test('does NOT have FechaHoraFirma', !xml.includes('<FechaHoraFirma>'));
test('does NOT have PeriodoDesde', !xml.includes('<PeriodoDesde>'));
test('does NOT have CantidadECF', !xml.includes('<CantidadECF>'));

// IdDoc
test('has Version 1.0', xml.includes('<Version>1.0</Version>'));
test('has TipoeCF 32', xml.includes('<TipoeCF>32</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E320000000001</eNCF>'));
test('has TipoIngresos 01', xml.includes('<TipoIngresos>01</TipoIngresos>'));
test('has TipoPago 1', xml.includes('<TipoPago>1</TipoPago>'));
test('has TablaFormasPago', xml.includes('<TablaFormasPago>'));
test('has FormaPago 1', xml.includes('<FormaPago>1</FormaPago>'));
test('has MontoPago 1180.00', xml.includes('<MontoPago>1180.00</MontoPago>'));

// Emisor
test('has Emisor block', xml.includes('<Emisor>'));
test('has RNCEmisor inside Emisor', /<Emisor>[\s\S]*<RNCEmisor>02800918407<\/RNCEmisor>[\s\S]*<\/Emisor>/.test(xml));
test('has RazonSocialEmisor inside Emisor', /<Emisor>[\s\S]*<RazonSocialEmisor>Juan Pérez<\/RazonSocialEmisor>[\s\S]*<\/Emisor>/.test(xml));
test('has FechaEmision dd-MM-yyyy', xml.includes('<FechaEmision>05-09-2026</FechaEmision>'));

// Comprador (siempre presente como elemento)
test('has Comprador block', xml.includes('<Comprador>'));

// Totales
test('has MontoGravadoTotal 1000.00', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has MontoGravadoI1 1000.00', xml.includes('<MontoGravadoI1>1000.00</MontoGravadoI1>'));
test('has TotalITBIS 180.00', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has TotalITBIS1 180.00', xml.includes('<TotalITBIS1>180.00</TotalITBIS1>'));
test('has MontoTotal 1180.00', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// CodigoSeguridadeCF
test('has CodigoSeguridadeCF ABC123', xml.includes('<CodigoSeguridadeCF>ABC123</CodigoSeguridadeCF>'));

// No tags vacíos
test('does NOT have empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*><\/[a-zA-Z0-9_:]+>/));

// --- Caso 2: factura con comprador extranjero y exento ---
const invoiceData2 = {
    ncf: 'E320000000002',
    tipoIngresos: '01',
    tipoPago: 1,
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuedAt: new Date('2026-09-15'),
    receiverIdentificadorExtranjero: 'EXT123456',
    receiverName: 'John Doe',
    exemptAmount: 2000.00,
    total: 2000.00,
};

const xml2 = buildRFCE(invoiceData2, 'XYZ789');
test('case2: has IdentificadorExtranjero', xml2.includes('<IdentificadorExtranjero>EXT123456</IdentificadorExtranjero>'));
test('case2: has RazonSocialComprador', xml2.includes('<RazonSocialComprador>John Doe</RazonSocialComprador>'));
test('case2: has MontoExento 2000.00', xml2.includes('<MontoExento>2000.00</MontoExento>'));
test('case2: has MontoTotal 2000.00', xml2.includes('<MontoTotal>2000.00</MontoTotal>'));

// --- Caso 3: validaciones ---
console.log('\n=== TESTS: validaciones ===\n');

try {
    buildRFCE({ ...invoiceData, ncf: 'E32' }, 'ABC123');
    test('throws if eNCF != 13 chars', false, 'should have thrown');
} catch (e) {
    test('throws if eNCF != 13 chars', true);
}

try {
    buildRFCE(invoiceData, 'AB');
    test('throws if codigoSeguridad != 6 chars', false, 'should have thrown');
} catch (e) {
    test('throws if codigoSeguridad != 6 chars', true);
}

try {
    buildRFCE({ ...invoiceData, total: undefined }, 'ABC123');
    test('throws if total is missing', false, 'should have thrown');
} catch (e) {
    test('throws if total is missing', true);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);