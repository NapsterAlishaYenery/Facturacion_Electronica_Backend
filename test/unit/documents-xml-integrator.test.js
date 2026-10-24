// ============================================================
// Test unitario: xml-integrator (Step D1)
// Verifica que buildInvoiceDataForXML propague los campos DGII de línea
// ============================================================

const { buildInvoiceDataForXML } = require('../../src/modules/documents/xml/xml-integrator');

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

// Helpers: armamos objetos planos (sin Sequelize) para no depender de la DB
function fakeInvoice(overrides = {}) {
    return {
        ncf: 'E310000000001',
        type: '31',
        issuedAt: new Date('2026-10-24T10:00:00'),
        subtotal: 1000,
        itbis: 180,
        total: 1180,
        montoGravado: 1000,
        itbis1Base: 1000,
        itbis1Amount: 180,
        exemptAmount: null,
        itbis3Base: null,
        itbis3Amount: null,
        totalItbisRetenido: null,
        totalIsrRetencion: null,
        itbis2Base: null,
        itbis2Amount: null,
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        receiverIdentificadorExtranjero: null,
        receiverPais: null,
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

function fakeCompany() {
    return {
        rnc: '02800918407',
        name: 'Emisor SRL',
        tradeName: null,
        address: 'Calle Test #1',
        phone: null,
        email: null,
        economicActivity: null
    };
}

function fakeLine(overrides = {}) {
    return {
        lineNumber: 1,
        itemCode: null,
        itemName: 'Item',
        description: null,
        indicadorBienoServicio: 1,
        unidadMedida: null,
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        recargo: 0,
        cantidadReferencia: null,
        unidadReferencia: null,
        gradosAlcohol: null,
        precioUnitarioReferencia: null,
        fechaElaboracion: null,
        fechaVencimientoItem: null,
        itbisRate: 18,
        itbisAmount: 18,
        indicadorFacturacion: 1,
        total: 118,
        retencionIndicador: null,
        montoItbisRetenido: null,
        montoIsrRetenido: null,
        ...overrides
    };
}

console.log('=== TESTS: xml-integrator buildInvoiceDataForXML (Step D1) ===\n');

// ------------------------------------------------------------
// 1. Servicio sin unidadMedida
// ------------------------------------------------------------
console.log('--- Caso 1: servicio sin unidadMedida ---');
{
    const line = fakeLine({
        itemName: 'Consultoría DGII',
        description: 'Consultoría por 10 horas',
        indicadorBienoServicio: 2,
        unidadMedida: null
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    const out = data.lines[0];
    test('itemName propagado', out.itemName === 'Consultoría DGII', out.itemName);
    test('description propagada', out.description === 'Consultoría por 10 horas');
    test('indicadorBienoServicio = 2', out.indicadorBienoServicio === 2);
    test('unidadMedida = null', out.unidadMedida === null);
}

// ------------------------------------------------------------
// 2. Bien con unidadMedida
// ------------------------------------------------------------
console.log('\n--- Caso 2: bien con unidadMedida 43 ---');
{
    const line = fakeLine({
        itemName: 'Laptop HP',
        indicadorBienoServicio: 1,
        unidadMedida: 43
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    const out = data.lines[0];
    test('indicadorBienoServicio = 1', out.indicadorBienoServicio === 1);
    test('unidadMedida = 43', out.unidadMedida === 43);
}

// ------------------------------------------------------------
// 3. Fallback: itemName vacío → usa description (dato histórico)
// ------------------------------------------------------------
console.log('\n--- Caso 3: itemName vacío (dato histórico) → fallback a description ---');
{
    const line = fakeLine({
        itemName: null,       // ← dato viejo, no tenía itemName
        description: 'Producto viejo sin nombre nuevo',
        indicadorBienoServicio: 1,
        unidadMedida: 43
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    const out = data.lines[0];
    test('itemName usa description como fallback',
        out.itemName === 'Producto viejo sin nombre nuevo', out.itemName);
    test('description también se preserva',
        out.description === 'Producto viejo sin nombre nuevo');
}

// ------------------------------------------------------------
// 4. Fallback total: itemName Y description vacíos → "Item"
// ------------------------------------------------------------
console.log('\n--- Caso 4: sin itemName ni description → "Item" ---');
{
    const line = fakeLine({
        itemName: null,
        description: null
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    const out = data.lines[0];
    test('itemName = "Item" (fallback final)', out.itemName === 'Item', out.itemName);
    test('description = null', out.description === null);
}

// ------------------------------------------------------------
// 5. Licor: gradosAlcohol, referencias, fechas
// ------------------------------------------------------------
console.log('\n--- Caso 5: licor completo ---');
{
    const elab = new Date('2025-01-15');
    const venc = new Date('2030-01-15');

    const line = fakeLine({
        itemName: 'Whisky Old Parr 750ml',
        description: 'Botella 750ml, edición especial',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        gradosAlcohol: 40,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        precioUnitarioReferencia: 2700,
        fechaElaboracion: elab,
        fechaVencimientoItem: venc
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    const out = data.lines[0];
    test('gradosAlcohol = 40', out.gradosAlcohol === 40, out.gradosAlcohol);
    test('cantidadReferencia = 750', out.cantidadReferencia === 750);
    test('unidadReferencia = 59', out.unidadReferencia === 59);
    test('precioUnitarioReferencia = 2700', out.precioUnitarioReferencia === 2700);
    test('fechaElaboracion propagada', out.fechaElaboracion === elab);
    test('fechaVencimientoItem propagada', out.fechaVencimientoItem === venc);
}

// ------------------------------------------------------------
// 6. Recargo > 0
// ------------------------------------------------------------
console.log('\n--- Caso 6: recargo > 0 ---');
{
    const line = fakeLine({
        itemName: 'Producto con recargo',
        recargo: 100
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    test('recargo = 100', data.lines[0].recargo === 100);
}

// ------------------------------------------------------------
// 7. Default de indicadorBienoServicio cuando no viene
// ------------------------------------------------------------
console.log('\n--- Caso 7: indicadorBienoServicio ausente → default 1 ---');
{
    const line = fakeLine({
        itemName: 'Test',
        indicadorBienoServicio: undefined
    });

    const data = buildInvoiceDataForXML(fakeInvoice(), [line], fakeCompany());

    test('indicadorBienoServicio = 1 (default)',
        data.lines[0].indicadorBienoServicio === 1);
}

// ------------------------------------------------------------
// 8. Múltiples líneas: cada una conserva sus campos
// ------------------------------------------------------------
console.log('\n--- Caso 8: múltiples líneas ---');
{
    const lines = [
        fakeLine({
            lineNumber: 1,
            itemName: 'Bien',
            indicadorBienoServicio: 1,
            unidadMedida: 43
        }),
        fakeLine({
            lineNumber: 2,
            itemName: 'Servicio',
            indicadorBienoServicio: 2,
            unidadMedida: null
        })
    ];

    const data = buildInvoiceDataForXML(fakeInvoice(), lines, fakeCompany());

    test('línea 1: Bien con unidad 43',
        data.lines[0].indicadorBienoServicio === 1
        && data.lines[0].unidadMedida === 43);
    test('línea 2: Servicio sin unidad',
        data.lines[1].indicadorBienoServicio === 2
        && data.lines[1].unidadMedida === null);
    test('ambas líneas presentes', data.lines.length === 2);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);