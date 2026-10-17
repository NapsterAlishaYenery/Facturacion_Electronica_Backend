// test/unit/xml-integrator.test.js
//
// Tests unitarios del xml-integrator.
// No toca BD ni red. Verifica transformación de datos.
//
// NO testea generateAndSaveInvoiceXML (eso va en integración).

const {
    buildInvoiceDataForXML,
    generateXMLForType
} = require('../../src/modules/documents/xml/xml-integrator');

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
function mockCompany() {
    return {
        rnc: '02800918407',
        name: 'ExpediNap SRL',
        tradeName: 'ExpediNap',
        email: 'test@expedinap.com',
        phone: '809-555-1234',
        address: 'Av. Principal 123, Santo Domingo',
        economicActivity: 'Software Development'
    };
}

function mockLine(overrides = {}) {
    return {
        lineNumber: 1,
        itemCode: 'ITEM-001',
        description: 'Servicio de consultoría',
        quantity: 2,
        unitPrice: 500,
        discount: 0,
        itbisRate: 18,
        itbisAmount: 180,
        indicadorFacturacion: 1,   // 🔥 NUEVO
        total: 1180,
        retencionIndicador: null,
        montoItbisRetenido: null,
        montoIsrRetenido: null,
        ...overrides
    };
}

function mockInvoice(overrides = {}) {
    return {
        id: '00000000-0000-0000-0000-000000000001',
        companyId: '00000000-0000-0000-0000-000000000002',
        type: '31',
        ncf: 'E310000000001',
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
        montoGravado: 1000,        // 🔥 NUEVO
        itbis1Base: 1000,          // 🔥 NUEVO
        itbis1Amount: 180,         // 🔥 NUEVO
        itbis2Base: 0,             // 🔥 NUEVO
        itbis2Amount: 0,           // 🔥 NUEVO
        exemptAmount: null,
        itbis3Base: null,
        itbis3Amount: null,
        totalItbisRetenido: null,
        totalIsrRetencion: null,
        issuedAt: new Date('2026-10-14'),
        transporteVia: null,
        transporteConductor: null,
        transportePlaca: null,
        infoFechaEmbarque: null,
        infoNumeroEmbarque: null,
        infoNumeroContenedor: null,
        modifiedNcf: null,
        modifiedNcfIssuerRnc: null,
        modifiedNcfDate: null,
        modificationCode: null,
        modificationReason: null,
        indicadorNotaCredito: null,
        ...overrides
    };
}

// ============================================================
// TEST 1: buildInvoiceDataForXML
// ============================================================
console.log('=== buildInvoiceDataForXML ===\n');

// --- Caso 1: factura 31 simple ---
const invoice31 = mockInvoice();
const lines31 = [mockLine()];
const company = mockCompany();

const data31 = buildInvoiceDataForXML(invoice31, lines31, company, null);

test('ncf mapeado', data31.ncf === 'E310000000001');
test('type mapeado', data31.type === '31');
test('issuerRnc desde company', data31.issuerRnc === '02800918407');
test('issuerName desde company', data31.issuerName === 'ExpediNap SRL');
test('issuerAddress desde company', data31.issuerAddress === 'Av. Principal 123, Santo Domingo');
test('receiverRnc mapeado', data31.receiverRnc === '13006904627');
test('receiverName mapeado', data31.receiverName === 'Cliente Test SRL');
test('subtotal como número', data31.subtotal === 1000);
test('itbis como número', data31.itbis === 180);
test('total como número', data31.total === 1180);
test('exemptAmount como 0 cuando null', data31.exemptAmount === 0);
test('itbis3Base como 0 cuando null', data31.itbis3Base === 0);

// 🔥 NUEVOS: verificar el fix DT-27
test('montoGravado mapeado como número', data31.montoGravado === 1000);
test('itbis1Base mapeado como número', data31.itbis1Base === 1000);
test('itbis1Amount mapeado como número', data31.itbis1Amount === 180);
test('itbis2Base mapeado como número', data31.itbis2Base === 0);
test('itbis2Amount mapeado como número', data31.itbis2Amount === 0);

test('lines array con 1 elemento', data31.lines.length === 1);
test('line.description mapeada', data31.lines[0].description === 'Servicio de consultoría');
test('line.quantity como número', data31.lines[0].quantity === 2);
test('line.unitPrice como número', data31.lines[0].unitPrice === 500);
test('line.retencion null cuando no hay', data31.lines[0].retencion === null);

// 🔥 NUEVO: verificar indicadorFacturacion mapeado en líneas
test('line.indicadorFacturacion mapeado', data31.lines[0].indicadorFacturacion === 1);

test('transporte null cuando no hay datos', data31.transporte === null);
test('informacionesAdicionales null cuando no hay datos', data31.informacionesAdicionales === null);

// --- Caso 2: factura 32 con comprador extranjero ---
const invoice32 = mockInvoice({
    type: '32',
    ncf: 'E320000000001',
    receiverRnc: null,
    receiverName: 'John Doe',
    receiverIdentificadorExtranjero: 'US-12345678'
});
const data32 = buildInvoiceDataForXML(invoice32, [mockLine()], company, null);

test('case2: receiverRnc null', data32.receiverRnc === null);
test('case2: receiverIdentificadorExtranjero mapeado', data32.receiverIdentificadorExtranjero === 'US-12345678');
test('case2: receiverName mapeado', data32.receiverName === 'John Doe');

// --- Caso 3: factura 46 con transporte + info adicional ---
const invoice46 = mockInvoice({
    type: '46',
    ncf: 'E460000000001',
    receiverIdentificadorExtranjero: 'US-12345678',
    receiverPais: 'Estados Unidos',
    itbis3Base: 5000,
    itbis3Amount: 0,
    transporteVia: '02',
    transportePaisOrigen: 'República Dominicana',
    transportePaisDestino: 'Estados Unidos',
    transporteNombreCompania: 'Ocean Freight SA',
    infoFechaEmbarque: new Date('2026-10-15'),
    infoNumeroEmbarque: 'EMB-001',
    infoNombrePuertoEmbarque: 'Puerto de Haina',
    infoTotalFob: 5000,
    infoFlete: 200
});
const data46 = buildInvoiceDataForXML(invoice46, [mockLine()], company, null);

test('case3: transporte no es null', data46.transporte !== null);
test('case3: transporte.viaTransporte', data46.transporte.viaTransporte === '02');
test('case3: transporte.paisDestino', data46.transporte.paisDestino === 'Estados Unidos');
test('case3: infoAdicional no es null', data46.informacionesAdicionales !== null);
test('case3: infoAdicional.numeroEmbarque', data46.informacionesAdicionales.numeroEmbarque === 'EMB-001');
test('case3: itbis3Base como número', data46.itbis3Base === 5000);

// --- Caso 4: factura 34 (nota de crédito) ---
const invoice34 = mockInvoice({
    type: '34',
    ncf: 'E340000000001',
    modifiedNcf: 'E310000000001',
    modifiedNcfIssuerRnc: '02800918407',
    modifiedNcfDate: new Date('2026-10-01'),
    modificationCode: 1,
    modificationReason: 'Anulación por error',
    indicadorNotaCredito: 0
});
const data34 = buildInvoiceDataForXML(invoice34, [mockLine()], company, null);

test('case4: modifiedNcf mapeado', data34.modifiedNcf === 'E310000000001');
test('case4: modificationCode mapeado', data34.modificationCode === 1);
test('case4: indicadorNotaCredito mapeado', data34.indicadorNotaCredito === 0);

// --- Caso 5: línea con retención (tipo 41) ---
const invoice41 = mockInvoice({ type: '41', ncf: 'E410000000001' });
const line41 = mockLine({
    retencionIndicador: 1,
    montoItbisRetenido: 50,
    montoIsrRetenido: 25
});
const data41 = buildInvoiceDataForXML(invoice41, [line41], company, null);

test('case5: line.retencion no es null', data41.lines[0].retencion !== null);
test('case5: retencion.indicador', data41.lines[0].retencion.indicador === 1);
test('case5: retencion.montoItbisRetenido', data41.lines[0].retencion.montoItbisRetenido === 50);
test('case5: retencion.montoIsrRetenido', data41.lines[0].retencion.montoIsrRetenido === 25);

// --- Caso 6: 🔥 FIX DT-27 — líneas mixtas (18% + 16% + exento) ---
const invoiceMixed = mockInvoice({
    subtotal: 340000,       // backward-compat: montoGravado + exemptAmount
    itbis: 55800,
    total: 395800,
    montoGravado: 315000,   // 🔥 solo gravado
    itbis1Base: 270000,
    itbis1Amount: 48600,
    itbis2Base: 45000,
    itbis2Amount: 7200,
    exemptAmount: 25000
});
const linesMixed = [
    mockLine({ lineNumber: 1, description: 'Servidor', quantity: 1, unitPrice: 285000, discount: 15000, itbisRate: 18, itbisAmount: 48600, indicadorFacturacion: 1, total: 318600 }),
    mockLine({ lineNumber: 2, description: 'Licencia', quantity: 1, unitPrice: 45000, discount: 0, itbisRate: 16, itbisAmount: 7200, indicadorFacturacion: 2, total: 52200 }),
    mockLine({ lineNumber: 3, description: 'Instalación exenta', quantity: 1, unitPrice: 25000, discount: 0, itbisRate: 0, itbisAmount: 0, indicadorFacturacion: 4, total: 25000 })
];
const dataMixed = buildInvoiceDataForXML(invoiceMixed, linesMixed, company, null);

test('case6: montoGravado = 315000', dataMixed.montoGravado === 315000);
test('case6: exemptAmount = 25000', dataMixed.exemptAmount === 25000);
test('case6: itbis1Base = 270000', dataMixed.itbis1Base === 270000);
test('case6: itbis2Base = 45000', dataMixed.itbis2Base === 45000);
test('case6: 3 líneas mapeadas', dataMixed.lines.length === 3);
test('case6: line[0] indicador = 1', dataMixed.lines[0].indicadorFacturacion === 1);
test('case6: line[1] indicador = 2', dataMixed.lines[1].indicadorFacturacion === 2);
test('case6: line[2] indicador = 4', dataMixed.lines[2].indicadorFacturacion === 4);

// --- Caso 6-bis: generar XML y verificar Totales del fix DT-27 ---
const xmlMixed = generateXMLForType(dataMixed, '31');
test('case6: XML contiene MontoGravadoTotal 315000.00', xmlMixed.includes('<MontoGravadoTotal>315000.00</MontoGravadoTotal>'));
test('case6: XML contiene MontoGravadoI1 270000.00', xmlMixed.includes('<MontoGravadoI1>270000.00</MontoGravadoI1>'));
test('case6: XML contiene MontoGravadoI2 45000.00', xmlMixed.includes('<MontoGravadoI2>45000.00</MontoGravadoI2>'));
test('case6: XML contiene MontoExento 25000.00', xmlMixed.includes('<MontoExento>25000.00</MontoExento>'));
test('case6: XML contiene TotalITBIS 55800.00', xmlMixed.includes('<TotalITBIS>55800.00</TotalITBIS>'));
test('case6: XML contiene TotalITBIS1 48600.00', xmlMixed.includes('<TotalITBIS1>48600.00</TotalITBIS1>'));
test('case6: XML contiene TotalITBIS2 7200.00', xmlMixed.includes('<TotalITBIS2>7200.00</TotalITBIS2>'));
test('case6: XML contiene IndicadorFacturacion 4 (exento)', xmlMixed.includes('<IndicadorFacturacion>4</IndicadorFacturacion>'));
// ============================================================
// TEST 2: generateXMLForType
// ============================================================
console.log('\n=== generateXMLForType ===\n');

// --- Generar XML de factura 31 ---
const xml31 = generateXMLForType(data31, '31');
test('xml31 es string', typeof xml31 === 'string');
test('xml31 empieza con declaración XML', xml31.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
test('xml31 contiene <ECF>', xml31.includes('<ECF>'));
test('xml31 contiene el NCF', xml31.includes('E310000000001'));
test('xml31 contiene RNCEmisor', xml31.includes('<RNCEmisor>02800918407</RNCEmisor>'));
test('xml31 contiene RNCComprador', xml31.includes('<RNCComprador>13006904627</RNCComprador>'));
test('xml31 no tiene tags vacíos', !xml31.match(/<[a-zA-Z0-9_:]+[^>]*><\/[a-zA-Z0-9_:]+>/));

// --- Generar XML de factura 32 ---
const xml32 = generateXMLForType(data32, '32');
test('xml32 es string', typeof xml32 === 'string');
test('xml32 contiene <TipoeCF>32</TipoeCF>', xml32.includes('<TipoeCF>32</TipoeCF>'));
test('xml32 contiene IdentificadorExtranjero', xml32.includes('<IdentificadorExtranjero>US-12345678</IdentificadorExtranjero>'));

// --- Generar XML de factura 46 ---
const xml46 = generateXMLForType(data46, '46');
test('xml46 es string', typeof xml46 === 'string');
test('xml46 contiene <Transporte>', xml46.includes('<Transporte>'));
test('xml46 contiene <ViaTransporte>02</ViaTransporte>', xml46.includes('<ViaTransporte>02</ViaTransporte>'));

// --- Generar XML de factura 34 ---
const xml34 = generateXMLForType(data34, '34');
test('xml34 es string', typeof xml34 === 'string');
test('xml34 contiene <InformacionReferencia>', xml34.includes('<InformacionReferencia>'));
test('xml34 contiene NCFModificado', xml34.includes('<NCFModificado>E310000000001</NCFModificado>'));

// --- Error con tipo inválido ---
try {
    generateXMLForType(data31, '99');
    test('tipo inválido lanza error', false, 'should have thrown');
} catch (err) {
    test('tipo inválido lanza error', err.code === 'INVALID_ECF_TYPE');
}

// ============================================================
// RESULTADO
// ============================================================
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);