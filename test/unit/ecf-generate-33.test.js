const {
    generateECF33,
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
// DATOS DE PRUEBA para e-CF 33 (Nota de Débito)
// ============================================================
const validInvoice33 = {
    ncf: 'E330000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
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

    // Campos específicos del 33
    modifiedNcf: 'E310000000001',
    modifiedNcfIssuerRnc: '130999888',
    modifiedNcfDate: new Date('2026-09-20'),
    modificationCode: 3,
    modificationReason: 'Ajuste de precio por error en factura original',

    lines: [{
        lineNumber: 1,
        description: 'Servicio profesional (ajuste)',
        quantity: 1,
        unitPrice: 1000.00,
        discount: 0,
        itbisRate: 18,
        itemCode: 'SERV-01'
    }]
};

console.log('=== TESTS: generateECF33 ===\n');
const xml = generateECF33(validInvoice33);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — particularidades del 33
test('has TipoeCF 33', xml.includes('<TipoeCF>33</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E330000000001</eNCF>'));
test('has FechaVencimientoSecuencia', xml.includes('<FechaVencimientoSecuencia>31-12-2026</FechaVencimientoSecuencia>'));
test('has TablaFormasPago', xml.includes('<TablaFormasPago>'));
test('does NOT have IndicadorNotaCredito', !xml.includes('<IndicadorNotaCredito>'));

// Emisor / Comprador
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RNCComprador', xml.includes('<RNCComprador>130999888</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Empresa Compradora SRL</RazonSocialComprador>'));

// InformacionReferencia (obligatorio en 33)
test('has InformacionReferencia', xml.includes('<InformacionReferencia>'));
test('has NCFModificado', xml.includes('<NCFModificado>E310000000001</NCFModificado>'));
test('has RNCOtroContribuyente', xml.includes('<RNCOtroContribuyente>130999888</RNCOtroContribuyente>'));
test('has FechaNCFModificado', xml.includes('<FechaNCFModificado>20-09-2026</FechaNCFModificado>'));
test('has CodigoModificacion', xml.includes('<CodigoModificacion>3</CodigoModificacion>'));
test('has RazonModificacion', xml.includes('<RazonModificacion>Ajuste de precio por error en factura original</RazonModificacion>'));

// Orden: InformacionReferencia DESPUÉS de DetallesItems y ANTES de FechaHoraFirma
const idxDetalles = xml.indexOf('<DetallesItems>');
const idxRef = xml.indexOf('<InformacionReferencia>');
const idxFirma = xml.indexOf('<FechaHoraFirma>');
test('InformacionReferencia after DetallesItems', idxRef > idxDetalles);
test('InformacionReferencia before FechaHoraFirma', idxRef > 0 && idxRef < idxFirma);

// Totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 33 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '33');
test('XML 33 passes XSD validation', xsdResult.valid, JSON.stringify(xsdResult.errors));

// Campos obligatorios
console.log('\n=== TESTS: campos obligatorios ===\n');

try {
    generateECF33({ ...validInvoice33, modifiedNcf: null });
    test('throws if no modifiedNcf', false, 'should have thrown');
} catch (e) {
    test('throws if no modifiedNcf', e.message.includes('NCFModificado is required'));
}

try {
    generateECF33({ ...validInvoice33, modifiedNcfDate: null });
    test('throws if no modifiedNcfDate', false, 'should have thrown');
} catch (e) {
    test('throws if no modifiedNcfDate', e.message.includes('FechaNCFModificado is required'));
}

try {
    generateECF33({ ...validInvoice33, modificationCode: null });
    test('throws if no modificationCode', false, 'should have thrown');
} catch (e) {
    test('throws if no modificationCode', e.message.includes('CodigoModificacion is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);