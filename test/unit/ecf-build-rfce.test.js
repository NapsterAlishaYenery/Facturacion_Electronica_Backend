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

const rfceData = {
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    periodFrom: new Date('2026-09-01'),
    periodTo: new Date('2026-09-30'),
    issuedAt: new Date('2026-10-01T08:00:00'),
    invoices: [
        {
            ncf: 'E320000000001',
            issuedAt: new Date('2026-09-05'),
            itbis1Base: 1000.00,
            itbis1Amount: 180.00,
            total: 1180.00
        },
        {
            ncf: 'E320000000002',
            issuedAt: new Date('2026-09-15'),
            itbis1Base: 500.00,
            itbis1Amount: 90.00,
            total: 590.00
        },
        {
            ncf: 'E320000000003',
            issuedAt: new Date('2026-09-25'),
            itbis3Base: 2000.00,
            total: 2000.00
        }
    ]
};

console.log('=== TESTS: buildRFCE ===\n');

const xml = buildRFCE(rfceData);
console.log('   XML length:', xml.length, 'chars\n');

// Estructura
test('has XML declaration', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('has RFCE root', xml.includes('<RFCE>'));
test('has closing RFCE', xml.includes('</RFCE>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetalleECF', xml.includes('<DetalleECF>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// IdDoc
test('has TipoeCF 32', xml.includes('<TipoeCF>32</TipoeCF>'));
test('has RNCEmisor', xml.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('has RazonSocialEmisor', xml.includes('<RazonSocialEmisor>Juan Pérez</RazonSocialEmisor>'));
test('has PeriodoDesde', xml.includes('<PeriodoDesde>01-09-2026</PeriodoDesde>'));
test('has PeriodoHasta', xml.includes('<PeriodoHasta>30-09-2026</PeriodoHasta>'));
test('has FechaEmision', xml.includes('<FechaEmision>01-10-2026</FechaEmision>'));

// Totales consolidados
test('has TotalMontoGravado 3500.00', xml.includes('<TotalMontoGravado>3500.00</TotalMontoGravado>'));
test('has TotalITBIS 270.00', xml.includes('<TotalITBIS>270.00</TotalITBIS>'));
test('has TotalMonto 3770.00', xml.includes('<TotalMonto>3770.00</TotalMonto>'));
test('has CantidadECF 3', xml.includes('<CantidadECF>3</CantidadECF>'));

// Detalle
test('has 3 ECFResumen', (xml.match(/<ECFResumen>/g) || []).length === 3);
test('has first eNCF', xml.includes('<eNCF>E320000000001</eNCF>'));
test('has second eNCF', xml.includes('<eNCF>E320000000002</eNCF>'));
test('has third eNCF', xml.includes('<eNCF>E320000000003</eNCF>'));

// No tags vacíos
test('does NOT have empty tags', !xml.match(/<[a-zA-Z0-9_:]+[^>]*><\/[a-zA-Z0-9_:]+>/));

// Test: sin facturas → error
console.log('\n=== TESTS: validación ===\n');

try {
    buildRFCE({ ...rfceData, invoices: [] });
    test('throws if no invoices', false, 'should have thrown');
} catch (error) {
    test('throws if no invoices', error.message.includes('at least one invoice'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);