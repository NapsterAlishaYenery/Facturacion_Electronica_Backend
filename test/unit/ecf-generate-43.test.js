const {
    generateECF43,
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

const validInvoice43 = {
    ncf: 'E430000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    // 43 NO tiene Comprador
    paymentType: 1,
    issuedAt: new Date('2026-09-27T10:30:00'),
    // 43 solo maneja monto exento (no ITBIS)
    total: 500.00,
    exemptAmount: 500.00,
    lines: [{
        lineNumber: 1,
        description: 'Gasto menor',
        quantity: 1,
        unitPrice: 500.00,
        discount: 0,
        itbisRate: 0,
        itemCode: 'GAS-01'
    }]
};

console.log('=== TESTS: generateECF43 ===\n');
const xml = generateECF43(validInvoice43);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — 43 no tiene TipoIngresos, ni IndicadorMontoGravado, ni FechaLimitePago
test('has TipoeCF 43', xml.includes('<TipoeCF>43</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E430000000001</eNCF>'));
test('has FechaVencimientoSecuencia', xml.includes('<FechaVencimientoSecuencia>'));
test('has TipoPago', xml.includes('<TipoPago>1</TipoPago>'));
test('does NOT have TipoIngresos (43 no lo lleva)', !xml.includes('<TipoIngresos>'));
test('does NOT have IndicadorMontoGravado (43 no lo lleva)', !xml.includes('<IndicadorMontoGravado>'));
test('does NOT have FechaLimitePago (43 no lo lleva)', !xml.includes('<FechaLimitePago>'));
test('does NOT have TablaFormasPago (43 no lo lleva)', !xml.includes('<TablaFormasPago>'));

// Emisor
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('does NOT have CodigoVendedor (43 no lo lleva)', !xml.includes('<CodigoVendedor>'));

// 43 NO tiene Comprador
test('does NOT have Comprador (43 no lo lleva)', !xml.includes('<Comprador>'));

// Totales — 43 solo MontoExento + MontoTotal
test('has MontoExento', xml.includes('<MontoExento>500.00</MontoExento>'));
test('has MontoTotal', xml.includes('<MontoTotal>500.00</MontoTotal>'));
test('does NOT have MontoGravadoTotal', !xml.includes('<MontoGravadoTotal>'));
test('does NOT have ITBIS1', !xml.includes('<ITBIS1>'));
test('does NOT have TotalITBIS', !xml.includes('<TotalITBIS>'));

// Items — 43 sin descuentos ni recargos
const itemMatch = xml.match(/<Item>([\s\S]*?)<\/Item>/);
test('has Item block', itemMatch !== null);
if (itemMatch) {
    const itemContent = itemMatch[1];
    test('does NOT have DescuentoMonto', !itemContent.includes('<DescuentoMonto>'));
    test('does NOT have RecargoMonto', !itemContent.includes('<RecargoMonto>'));
}

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 43 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '43');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 43 passes XSD validation', xsdResult.valid);

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);