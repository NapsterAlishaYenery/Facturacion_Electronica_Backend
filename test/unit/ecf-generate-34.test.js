const {
    generateECF34,
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
// DATOS DE PRUEBA para e-CF 34 (Nota de Crédito)
// ============================================================
const validInvoice34 = {
    ncf: 'E340000000001',
    // NO sequenceExpiresAt: el XSD 34 no tiene FechaVencimientoSecuencia
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    receiverRnc: '130999888',
    receiverName: 'Empresa Compradora SRL',

    paymentType: 1,
    // NO paymentMethods: el XSD 34 no tiene TablaFormasPago

    issuedAt: new Date('2026-09-27T10:30:00'),
    subtotal: 1000.00,
    itbis: 180.00,
    total: 1180.00,
    itbis1Base: 1000.00,
    itbis1Amount: 180.00,

    // Específico del 34
    indicadorNotaCredito: 0,   // 0 = emisión <= 30 días, 1 = > 30 días

    modifiedNcf: 'E310000000001',
    modifiedNcfIssuerRnc: '130999888',
    modifiedNcfDate: new Date('2026-09-20'),
    modificationCode: 1,   // 1 = Anula el NCF modificado
    modificationReason: 'Anulación de factura por devolución',

    lines: [{
        lineNumber: 1,
        description: 'Devolución de servicio',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 18,
        itemCode: 'SERV-01'
    }]
};

console.log('=== TESTS: generateECF34 ===\n');
const xml = generateECF34(validInvoice34);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — particularidades del 34
test('has TipoeCF 34', xml.includes('<TipoeCF>34</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E340000000001</eNCF>'));
test('has IndicadorNotaCredito 0', xml.includes('<IndicadorNotaCredito>0</IndicadorNotaCredito>'));
test('does NOT have FechaVencimientoSecuencia', !xml.includes('<FechaVencimientoSecuencia>'));
test('does NOT have TablaFormasPago', !xml.includes('<TablaFormasPago>'));
test('does NOT have TerminoPago', !xml.includes('<TerminoPago>'));

// Emisor / Comprador
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RNCComprador', xml.includes('<RNCComprador>130999888</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Empresa Compradora SRL</RazonSocialComprador>'));

// InformacionReferencia (obligatorio en 34)
test('has InformacionReferencia', xml.includes('<InformacionReferencia>'));
test('has NCFModificado', xml.includes('<NCFModificado>E310000000001</NCFModificado>'));
test('has FechaNCFModificado', xml.includes('<FechaNCFModificado>20-09-2026</FechaNCFModificado>'));
test('has CodigoModificacion 1', xml.includes('<CodigoModificacion>1</CodigoModificacion>'));

// Orden
const idxDetalles = xml.indexOf('<DetallesItems>');
const idxRef = xml.indexOf('<InformacionReferencia>');
const idxFirma = xml.indexOf('<FechaHoraFirma>');
test('InformacionReferencia after DetallesItems', idxRef > idxDetalles);
test('InformacionReferencia before FechaHoraFirma', idxRef > 0 && idxRef < idxFirma);

// Totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 34 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '34');
test('XML 34 passes XSD validation', xsdResult.valid, JSON.stringify(xsdResult.errors));

// IndicadorNotaCredito
console.log('\n=== TESTS: IndicadorNotaCredito ===\n');

try {
    generateECF34({ ...validInvoice34, indicadorNotaCredito: null });
    test('throws if no indicadorNotaCredito', false, 'should have thrown');
} catch (e) {
    test('throws if no indicadorNotaCredito', e.message.includes('IndicadorNotaCredito is required'));
}

try {
    generateECF34({ ...validInvoice34, indicadorNotaCredito: 5 });
    test('throws if indicadorNotaCredito invalid', false, 'should have thrown');
} catch (e) {
    test('throws if indicadorNotaCredito invalid', e.message.includes('must be 0 or 1'));
}

// modifiedNcf obligatorio también en 34
try {
    generateECF34({ ...validInvoice34, modifiedNcf: null });
    test('throws if no modifiedNcf', false, 'should have thrown');
} catch (e) {
    test('throws if no modifiedNcf', e.message.includes('NCFModificado is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);