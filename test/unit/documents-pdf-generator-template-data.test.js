// ============================================================
// Test unitario: pdf-generator buildTemplateData (Step D2)
// Verifica que los nuevos campos estén disponibles para los templates
// ============================================================

const { buildTemplateData } = require('../../src/modules/documents/pdf/pdf-generator');

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

// Helpers: objetos planos (sin Sequelize)
function fakeInvoice(overrides = {}) {
    return {
        type: '31',
        ncf: 'E310000000001',
        status: 'draft',
        issuedAt: new Date('2026-10-24T10:00:00'),
        subtotal: 1000,
        itbis: 180,
        total: 1180,
        issuerRnc: '02800918407',
        issuerName: 'Emisor SRL',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
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
        economicActivity: null,
        logos: []
    };
}

function fakeLine(overrides = {}) {
    return {
        lineNumber: 1,
        itemCode: null,
        itemName: 'Item',
        description: null,
        unidadMedida: null,
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        recargo: 0,
        itbisRate: 18,
        itbisAmount: 18,
        total: 118,
        ...overrides
    };
}

(async () => {
    console.log('=== TESTS: pdf-generator buildTemplateData (Step D2) ===\n');

    // ------------------------------------------------------------
    // 1. Unidad 21 (kg)
    // ------------------------------------------------------------
    console.log('--- Caso 1: unidadMedida 21 ---');
    {
        const line = fakeLine({ itemName: 'Arroz Selecto', unidadMedida: 21 });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('unidadMedidaLabel = "kg"', data.lines[0].unidadMedidaLabel === 'kg', data.lines[0].unidadMedidaLabel);
    }

    // ------------------------------------------------------------
    // 2. Unidad 43 (Unidad)
    // ------------------------------------------------------------
    console.log('\n--- Caso 2: unidadMedida 43 ---');
    {
        const line = fakeLine({ itemName: 'Laptop', unidadMedida: 43 });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('unidadMedidaLabel = "Unidad"', data.lines[0].unidadMedidaLabel === 'Unidad');
    }

    // ------------------------------------------------------------
    // 3. Sin unidadMedida (servicio)
    // ------------------------------------------------------------
    console.log('\n--- Caso 3: unidadMedida null ---');
    {
        const line = fakeLine({ itemName: 'Consultoría', unidadMedida: null });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('unidadMedidaLabel = ""', data.lines[0].unidadMedidaLabel === '');
    }

    // ------------------------------------------------------------
    // 4. itemName con description distinta
    // ------------------------------------------------------------
    console.log('\n--- Caso 4: itemName + description distinta ---');
    {
        const line = fakeLine({
            itemName: 'Whisky Old Parr',
            description: 'Botella 750ml, edición especial'
        });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('itemName preservado', data.lines[0].itemName === 'Whisky Old Parr');
        test('description visible', data.lines[0].hasDescription === true);
        test('description contenida', data.lines[0].description === 'Botella 750ml, edición especial');
    }

    // ------------------------------------------------------------
    // 5. itemName con description igual (no duplicar)
    // ------------------------------------------------------------
    console.log('\n--- Caso 5: itemName + description igual ---');
    {
        const line = fakeLine({
            itemName: 'Laptop HP',
            description: 'Laptop HP'
        });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('hasDescription = false (no duplicar)', data.lines[0].hasDescription === false);
        test('description null', data.lines[0].description === null);
    }

    // ------------------------------------------------------------
    // 6. itemName null → fallback a description
    // ------------------------------------------------------------
    console.log('\n--- Caso 6: itemName null → fallback ---');
    {
        const line = fakeLine({
            itemName: null,
            description: 'Producto viejo'
        });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('itemName usa description', data.lines[0].itemName === 'Producto viejo');
    }

    // ------------------------------------------------------------
    // 7. Recargo > 0
    // ------------------------------------------------------------
    console.log('\n--- Caso 7: recargo 100 ---');
    {
        const line = fakeLine({ itemName: 'Producto', recargo: 100 });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('hasRecargo = true', data.lines[0].hasRecargo === true);
        test('recargo = "100.00"', data.lines[0].recargo === '100.00');
        test('totalRecargos presente', data.hasTotalRecargos === true);
        test('totalRecargos = "100.00"', data.totalRecargos === '100.00');
    }

    // ------------------------------------------------------------
    // 8. Sin recargo → totalRecargos null
    // ------------------------------------------------------------
    console.log('\n--- Caso 8: sin recargo ---');
    {
        const line = fakeLine({ itemName: 'Producto', recargo: 0 });
        const data = await buildTemplateData(fakeInvoice(), [line], fakeCompany());
        test('hasRecargo = false', data.lines[0].hasRecargo === false);
        test('hasTotalRecargos = false', data.hasTotalRecargos === false);
        test('totalRecargos = null', data.totalRecargos === null);
    }

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();