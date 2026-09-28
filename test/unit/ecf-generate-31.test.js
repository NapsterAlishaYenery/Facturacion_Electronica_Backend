const { generateECF31 } = require('../../src/modules/invoices/ecf/xml-generator');

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
// DATOS DE PRUEBA para e-CF 31 (Crédito Fiscal)
// ============================================================

const validInvoice31 = {
    ncf: 'E310000000001',
    sequenceExpiresAt: new Date('2026-12-31'),
    issuerRnc: '02800918407',
    issuerName: 'Juan Pérez',
    issuerTradeName: 'Barbería Juan',
    issuerAddress: 'Calle Duarte #45, Higüey',
    issuerMunicipio: '110100',
    issuerProvincia: '11',
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
    lines: [
        {
            lineNumber: 1,
            description: 'Servicio profesional',
            quantity: 1,
            unitPrice: 1000.00,
            discount: 0,
            itbisRate: 18,
            itemCode: 'SERV-01'
        }
    ]
};

console.log('=== TESTS: generateECF31 ===\n');

const xml = generateECF31(validInvoice31);
console.log('   XML length:', xml.length, 'chars\n');

// Verificar tipo
test('has TipoeCF 31', xml.includes('<TipoeCF>31</TipoeCF>'));
test('has eNCF with E31', xml.includes('<eNCF>E310000000001</eNCF>'));

// Verificar comprador OBLIGATORIO
test('has RNCComprador', xml.includes('<RNCComprador>130999888</RNCComprador>'));
test('has RazonSocialComprador', xml.includes('<RazonSocialComprador>Empresa Compradora SRL</RazonSocialComprador>'));

// Verificar estructura general
test('has ECF root', xml.includes('<ECF>'));
test('has Encabezado', xml.includes('<Encabezado>'));
test('has DetallesItems', xml.includes('<DetallesItems>'));
test('has FechaHoraFirma', xml.includes('<FechaHoraFirma>'));

// Verificar totales
test('has MontoGravadoTotal', xml.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
test('has ITBIS1', xml.includes('<ITBIS1>18</ITBIS1>'));
test('has TotalITBIS', xml.includes('<TotalITBIS>180.00</TotalITBIS>'));
test('has MontoTotal', xml.includes('<MontoTotal>1180.00</MontoTotal>'));

// ============================================================
// TEST: sin RNC Comprador → Error
// ============================================================
console.log('\n=== TESTS: validación de comprador obligatorio ===\n');

const invoiceNoReceiver = { ...validInvoice31, receiverRnc: null };

try {
    generateECF31(invoiceNoReceiver);
    test('throws if no receiverRnc', false, 'should have thrown');
} catch (error) {
    test('throws if no receiverRnc', error.message.includes('RNC Comprador is required'));
}

const invoiceNoName = { ...validInvoice31, receiverName: null };

try {
    generateECF31(invoiceNoName);
    test('throws if no receiverName', false, 'should have thrown');
} catch (error) {
    test('throws if no receiverName', error.message.includes('Razón Social Comprador is required'));
}

// ============================================================
// TEST: verificar que e-CF 32 sigue funcionando
// ============================================================
console.log('\n=== TESTS: regresión de e-CF 32 ===\n');

const { generateECF32 } = require('../../src/modules/invoices/ecf/xml-generator');

const invoice32 = {
    ...validInvoice31,
    ncf: 'E320000000001',
    receiverRnc: null,      // ← opcional en 32
    receiverName: 'Cliente Final'
};

const xml32 = generateECF32(invoice32);

test('e-CF 32 still has TipoeCF 32', xml32.includes('<TipoeCF>32</TipoeCF>'));
test('e-CF 32 still allows no RNC Comprador', !xml32.includes('<RNCComprador>'));
test('e-CF 32 has RazonSocialComprador', xml32.includes('<RazonSocialComprador>Cliente Final</RazonSocialComprador>'));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);