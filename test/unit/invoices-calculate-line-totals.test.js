// ============================================================
// Test unitario: calculateLineTotals (Step 2)
// ============================================================

// Importamos el helper interno del servicio
const invoicesService = require('../../src/modules/invoices/invoices.service');
const calculateLineTotals = invoicesService._helpers.calculateLineTotals;

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

function round2(n) {
    return Math.round(n * 100) / 100;
}

console.log('=== TESTS: calculateLineTotals (Step 2) ===\n');

// ------------------------------------------------------------
// 1. Línea simple SIN recargo → mismo resultado que antes
// ------------------------------------------------------------
console.log('--- Caso 1: sin recargo (backward-compat) ---');
{
    const result = calculateLineTotals({
        itemName: 'Servicio profesional',
        quantity: 2,
        unitPrice: 1000,
        discount: 100,
        itbisRate: 18
    });

    const expectedBase = 2 * 1000 - 100;       // 1900
    const expectedItbis = 1900 * 0.18;         // 342
    const expectedTotal = 1900 + 342;          // 2242

    test('recargo = 0 (default)', result.recargo === 0);
    test('lineBase = 1900', result.lineBase === round2(expectedBase), `got ${result.lineBase}`);
    test('itbisAmount = 342', result.itbisAmount === round2(expectedItbis), `got ${result.itbisAmount}`);
    test('total = 2242', result.total === round2(expectedTotal), `got ${result.total}`);
    test('itbisRate = 18', result.itbisRate === 18);
    test('indicadorFacturacion = 1', result.indicadorFacturacion === 1);
}

// ------------------------------------------------------------
// 2. Línea CON recargo → base incluye el recargo
// ------------------------------------------------------------
console.log('\n--- Caso 2: con recargo ---');
{
    const result = calculateLineTotals({
        itemName: 'Producto con recargo',
        quantity: 1,
        unitPrice: 5000,
        discount: 0,
        recargo: 500,
        itbisRate: 18
    });

    // base = 1*5000 - 0 + 500 = 5500
    // itbis = 5500 * 0.18 = 990
    // total = 5500 + 990 = 6490

    test('recargo = 500', result.recargo === 500);
    test('lineBase = 5500', result.lineBase === 5500, `got ${result.lineBase}`);
    test('itbisAmount = 990', result.itbisAmount === 990, `got ${result.itbisAmount}`);
    test('total = 6490', result.total === 6490, `got ${result.total}`);
}

// ------------------------------------------------------------
// 3. Línea exenta (itbisRate 0) con recargo
// ------------------------------------------------------------
console.log('\n--- Caso 3: exento + recargo ---');
{
    const result = calculateLineTotals({
        itemName: 'Exento con recargo',
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        recargo: 20,
        itbisRate: 0,
        indicadorFacturacion: 4
    });

    // base = 200 - 0 + 20 = 220
    // itbis = 220 * 0 = 0
    // total = 220

    test('indicadorFacturacion = 4 (exento)', result.indicadorFacturacion === 4);
    test('lineBase = 220', result.lineBase === 220, `got ${result.lineBase}`);
    test('itbisAmount = 0', result.itbisAmount === 0);
    test('total = 220', result.total === 220);
}

// ------------------------------------------------------------
// 4. Propagación de campos nuevos
// ------------------------------------------------------------
console.log('\n--- Caso 4: propagación de campos nuevos ---');
{
    const fechaElab = new Date('2025-01-15');
    const fechaVenc = new Date('2030-01-15');

    const result = calculateLineTotals({
        itemName: 'Whisky Old Parr',
        description: 'Botella 750ml, edición especial',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        gradosAlcohol: 40,
        precioUnitarioReferencia: 2700,
        fechaElaboracion: fechaElab,
        fechaVencimientoItem: fechaVenc,
        recargo: 0,
        quantity: 1,
        unitPrice: 2500,
        discount: 0,
        itbisRate: 18
    });

    test('itemName propagado', result.itemName === 'Whisky Old Parr');
    test('description propagado', result.description === 'Botella 750ml, edición especial');
    test('indicadorBienoServicio = 1', result.indicadorBienoServicio === 1);
    test('unidadMedida = 5', result.unidadMedida === 5);
    test('cantidadReferencia = 750', result.cantidadReferencia === 750);
    test('unidadReferencia = 59', result.unidadReferencia === 59);
    test('gradosAlcohol = 40', result.gradosAlcohol === 40);
    test('precioUnitarioReferencia = 2700', result.precioUnitarioReferencia === 2700);
    test('fechaElaboracion propagada', result.fechaElaboracion === fechaElab);
    test('fechaVencimientoItem propagada', result.fechaVencimientoItem === fechaVenc);
}

// ------------------------------------------------------------
// 5. Defaults cuando los campos nuevos NO vienen
// ------------------------------------------------------------
console.log('\n--- Caso 5: defaults cuando faltan campos nuevos ---');
{
    const result = calculateLineTotals({
        quantity: 1,
        unitPrice: 100,
        itbisRate: 18
    });

    test('itemName = null', result.itemName === null);
    test('description = null', result.description === null);
    test('indicadorBienoServicio = 1 (default)', result.indicadorBienoServicio === 1);
    test('unidadMedida = null', result.unidadMedida === null);
    test('recargo = 0', result.recargo === 0);
    test('cantidadReferencia = null', result.cantidadReferencia === null);
    test('unidadReferencia = null', result.unidadReferencia === null);
    test('gradosAlcohol = null', result.gradosAlcohol === null);
    test('precioUnitarioReferencia = null', result.precioUnitarioReferencia === null);
    test('fechaElaboracion = null', result.fechaElaboracion === null);
    test('fechaVencimientoItem = null', result.fechaVencimientoItem === null);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);