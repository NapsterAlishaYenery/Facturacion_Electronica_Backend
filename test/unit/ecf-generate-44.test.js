const {
    generateECF44,
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

const validInvoice44 = {
    ncf: 'E440000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '110000',
    // 44 requiere RazonSocial pero no RNC
    receiverName: 'Cliente Régimen Especial',
    paymentType: 1,
    issuedAt: new Date('2026-09-27T10:30:00'),
    // 44 solo MontoExento (no ITBIS)
    total: 500.00,
    exemptAmount: 500.00,
    lines: [{
        lineNumber: 1,
        description: 'Producto régimen especial',
        quantity: 1,
        unitPrice: 500.00,
        discount: 0,
        itbisRate: 0,
        itemCode: 'RE-01'
    }]
};

console.log('=== TESTS: generateECF44 ===\n');
const xml = generateECF44(validInvoice44);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has ECF root tag', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc — 44 tiene TipoIngresos pero NO IndicadorMontoGravado
test('has TipoeCF 44', xml.includes('<TipoeCF>44</TipoeCF>'));
test('has eNCF', xml.includes('<eNCF>E440000000001</eNCF>'));
test('has TipoIngresos', xml.includes('<TipoIngresos>01</TipoIngresos>'));
test('does NOT have IndicadorMontoGravado (44 no lo lleva)', !xml.includes('<IndicadorMontoGravado>'));

// Comprador — 44 tiene RazonSocial obligatoria, RNC opcional
test('has Comprador', xml.includes('<Comprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Cliente Régimen Especial</RazonSocialComprador>'));

// Totales — 44 solo MontoExento + MontoTotal
test('has MontoExento', xml.includes('<MontoExento>500.00</MontoExento>'));
test('has MontoTotal', xml.includes('<MontoTotal>500.00</MontoTotal>'));
test('does NOT have ITBIS1', !xml.includes('<ITBIS1>'));
test('does NOT have TotalITBIS', !xml.includes('<TotalITBIS>'));

// XSD
console.log('\n=== TESTS: validateAgainstXSD tipo 44 ===\n');
clearXSDCache();
const xsdResult = validateAgainstXSD(xml, '44');
if (!xsdResult.valid) {
    console.log('   Errores XSD:');
    for (const e of xsdResult.errors) console.log('     -', e);
}
test('XML 44 passes XSD validation', xsdResult.valid);

// Validación: 44 exige RazonSocial
console.log('\n=== TESTS: campos obligatorios ===\n');

try {
    generateECF44({ ...validInvoice44, receiverName: null });
    test('throws if no receiverName', false, 'should have thrown');
} catch (e) {
    test('throws if no receiverName', e.message.includes('Razón Social Comprador is required'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);