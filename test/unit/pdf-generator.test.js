// test/unit/pdf-generator.test.js
//
// Verifica que pdf-generator genera PDFs válidos en los 3 formatos.

const {
    generateInvoicePDF,
    closeBrowser,
    isValidFormat,
    normalizeFormat
} = require('../../src/modules/documents/pdf/pdf-generator');

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

// ------------------------------------------------------------
// Mocks
// ------------------------------------------------------------
const mockCompany = {
    rnc: '02800918407',
    name: 'ExpediNap SRL',
    tradeName: 'ExpediNap',
    email: 'test@expedinap.com',
    phone: '809-836-6303',
    address: 'Higuey, La Altagracia',
    economicActivity: 'Servicios tecnológicos'
};

const mockInvoice = {
    id: 'invoice-001',
    companyId: 'company-001',
    type: '31',
    ncf: 'E310000000999',
    status: 'draft',
    issuerRnc: '02800918407',
    issuerName: 'ExpediNap SRL',
    receiverRnc: '13006904627',
    receiverName: 'Cliente Test SRL',
    receiverIdentificadorExtranjero: null,
    receiverPais: null,
    subtotal: 1000,
    itbis: 180,
    total: 1180,
    exemptAmount: null,
    itbis3Base: null,
    itbis3Amount: null,
    totalItbisRetenido: null,
    totalIsrRetencion: null,
    issuedAt: new Date('2026-10-15'),
    updatedAt: new Date(),
    transporteVia: null,
    transportePaisOrigen: null,
    transportePaisDestino: null,
    transporteConductor: null,
    transportePlaca: null,
    infoFechaEmbarque: null,
    infoNumeroEmbarque: null,
    infoNumeroContenedor: null,
    infoNombrePuertoEmbarque: null,
    infoCondicionesEntrega: null,
    infoTotalFob: null,
    infoSeguro: null,
    infoFlete: null,
    infoTotalCif: null,
    infoRegimenAduanero: null,
    modifiedNcf: null,
    modifiedNcfDate: null,
    modificationCode: null,
    modificationReason: null,
    xmlContent: null,
    xmlSigned: null
};

const mockLines = [
    {
        lineNumber: 1,
        itemCode: 'ITEM-001',
        description: 'Servicio de consultoría',
        quantity: 1,
        unitPrice: 1000,
        discount: 0,
        itbisRate: 18,
        itbisAmount: 180,
        total: 1180
    }
];

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    return null;
}

// ============================================================
// MAIN
// ============================================================
(async () => {
    console.log('=== pdf-generator ===\n');

    try {
        // ------------------------------------------------------------
        // TEST 0: helpers de formato
        // ------------------------------------------------------------
        console.log('  --- Helpers de formato ---');
        test('isValidFormat(a4)', isValidFormat('a4') === true);
        test('isValidFormat(ticket)', isValidFormat('ticket') === true);
        test('isValidFormat(half)', isValidFormat('half') === true);
        test('isValidFormat(invalid)', isValidFormat('invalid') === false);
        test('normalizeFormat(A4) → a4', normalizeFormat('A4') === 'a4');
        test('normalizeFormat(invalid) → a4', normalizeFormat('invalid') === 'a4');
        test('normalizeFormat(undefined) → a4', normalizeFormat(undefined) === 'a4');
        console.log('');

        // ------------------------------------------------------------
        // TEST 1-3: Los 3 formatos
        // ------------------------------------------------------------
        const formats = ['a4', 'ticket', 'half'];

        for (const fmt of formats) {
            console.log(`  --- Formato: ${fmt} ---`);

            const startTime = Date.now();
            const raw = await generateInvoicePDF(mockInvoice, mockLines, mockCompany, fmt);
            const durationMs = Date.now() - startTime;
            const buffer = toBuffer(raw);

            test(`${fmt}: devuelve Buffer`, buffer !== null);
            test(`${fmt}: no vacío`, buffer && buffer.length > 0);
            test(`${fmt}: empieza con %PDF`, buffer && buffer.slice(0, 4).toString() === '%PDF');
            test(`${fmt}: tamaño razonable`, buffer && buffer.length > 3000, `${buffer ? buffer.length : 0} bytes`);
            test(`${fmt}: <30s`, durationMs < 30000, `${durationMs}ms`);

            console.log(`      📄 ${buffer ? buffer.length : 0} bytes en ${durationMs}ms\n`);
        }

        // ------------------------------------------------------------
        // TEST 4: tipo 32 en A4
        // ------------------------------------------------------------
        console.log('  --- Tipo 32 en A4 ---');
        const invoice32 = {
            ...mockInvoice,
            type: '32',
            receiverRnc: null,
            receiverName: 'Consumidor Final'
        };
        const raw32 = await generateInvoicePDF(invoice32, mockLines, mockCompany, 'a4');
        const buffer32 = toBuffer(raw32);
        test('tipo 32 A4: válido', buffer32 && buffer32.slice(0, 4).toString() === '%PDF');
        console.log('');

        // ------------------------------------------------------------
        // TEST 5: error con datos faltantes
        // ------------------------------------------------------------
        console.log('  --- Error con datos faltantes ---');
        try {
            await generateInvoicePDF(null, null, null);
            test('lanza error con null', false, 'should have thrown');
        } catch (err) {
            test('lanza error con null', err.message.includes('requeridos'));
        }
        console.log('');

        // ------------------------------------------------------------
        // TEST 6: template data
        // ------------------------------------------------------------
        console.log('  --- Template data ---');
        const { buildTemplateData } = require('../../src/modules/documents/pdf/pdf-generator');
        const data = await buildTemplateData(mockInvoice, mockLines, mockCompany);

        test('typeName mapea 31', data.typeName === 'Factura de Crédito Fiscal Electrónica');
        test('ncf correcto', data.ncf === 'E310000000999');
        test('qrDataUrl no vacío', data.qrDataUrl && data.qrDataUrl.startsWith('data:image/png;base64,'));
        test('hasBuyer true para 31', data.hasBuyer === true);

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
        failed++;
    } finally {
        await closeBrowser();
    }

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();