// ============================================================
// scripts/diff-service.js (versión final)
// Compara el service original vs el barrel refactorizado.
//
// - Compara exports de primer nivel (11 métodos + _helpers).
// - Compara _helpers (11 funciones).
// - Compara firmas de los 11 métodos públicos.
// - Ejecuta los helpers puros con inputs deterministas.
// - create/update: solo firma (tocan BD; su comportamiento
//   se verificó manualmente en smoke tests).
// ============================================================

const oldS = require('../src/modules/invoices/invoices.service');
const newS = require('../src/modules/invoices/service');

let total = 0, passed = 0, failed = 0;

function ok(label, extra = '') {
    passed++; total++;
    console.log(`✓ ${label}${extra ? ' → ' + extra : ''}`);
}
function fail(label, extra = '') {
    failed++; total++;
    console.log(`✗ ${label}${extra ? ': ' + extra : ''}`);
}
function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================
// 1. Exports de primer nivel
// ============================================================
console.log('\n=== 1. EXPORTS (primer nivel) ===\n');

const oldKeys = Object.keys(oldS).sort();
const newKeys = Object.keys(newS).sort();

if (deepEqual(oldKeys, newKeys)) {
    ok('mismas claves', oldKeys.join(', '));
} else {
    fail('claves distintas');
    console.log('  OLD:', oldKeys);
    console.log('  NEW:', newKeys);
}

// ============================================================
// 2. _helpers
// ============================================================
console.log('\n=== 2. _helpers ===\n');

const oldHelpers = oldS._helpers || {};
const newHelpers = newS._helpers || {};

const oldHelperKeys = Object.keys(oldHelpers).sort();
const newHelperKeys = Object.keys(newHelpers).sort();

if (deepEqual(oldHelperKeys, newHelperKeys)) {
    ok('mismas claves en _helpers', oldHelperKeys.join(', '));
} else {
    fail('_helpers con claves distintas');
    console.log('  OLD:', oldHelperKeys);
    console.log('  NEW:', newHelperKeys);
}

// ============================================================
// 3. Firmas de todos los métodos públicos
// ============================================================
console.log('\n=== 3. FIRMAS (nº de args) ===\n');

for (const key of oldKeys) {
    if (key === '_helpers') continue;
    const oldFn = oldS[key];
    const newFn = newS[key];

    if (typeof oldFn !== 'function') continue;

    if (typeof newFn !== 'function') {
        fail(`${key}: no es función en el nuevo`);
        continue;
    }
    if (oldFn.length === newFn.length) {
        ok(`${key}`, `${oldFn.length} args`);
    } else {
        fail(`${key}: firma distinta`, `OLD ${oldFn.length} vs NEW ${newFn.length}`);
    }
}

// ============================================================
// 4. Firmas de los _helpers
// ============================================================
console.log('\n=== 4. FIRMAS _helpers ===\n');

for (const key of oldHelperKeys) {
    const oldFn = oldHelpers[key];
    const newFn = newHelpers[key];
    if (typeof oldFn !== 'function') continue;
    if (typeof newFn !== 'function') {
        fail(`${key}: no es función en el nuevo`);
        continue;
    }
    if (oldFn.length === newFn.length) {
        ok(`${key}`, `${oldFn.length} args`);
    } else {
        fail(`${key}: firma distinta`, `OLD ${oldFn.length} vs NEW ${newFn.length}`);
    }
}

// ============================================================
// 5. Ejecución funcional de los helpers puros
// ============================================================
console.log('\n=== 5. HELPERS PUROS (ejecución) ===\n');

// ---- 5.1 calculateLineTotals ----
{
    const inputs = [
        { quantity: 2, unitPrice: 100, discount: 0, recargo: 0, indicadorFacturacion: 1, itbisRate: 18 },
        { quantity: 3, unitPrice: 50, discount: 10, recargo: 5, indicadorFacturacion: 1, itbisRate: 18 },
        { quantity: 1, unitPrice: 100, discount: 0, recargo: 0, indicadorFacturacion: 4, itbisRate: 0 },
        { quantity: 1, unitPrice: 100, discount: 0, recargo: 0, itbisRate: 16 },
        {
            quantity: 2, unitPrice: 100, discount: 0, recargo: 0,
            indicadorFacturacion: 1, itbisRate: 18,
            precioOtraMoneda: 1.72, descuentoOtraMoneda: 0, recargoOtraMoneda: 0
        },
    ];
    let allOk = true;
    for (let i = 0; i < inputs.length; i++) {
        const oldOut = oldHelpers.calculateLineTotals(inputs[i]);
        const newOut = newHelpers.calculateLineTotals(inputs[i]);
        if (!deepEqual(oldOut, newOut)) {
            fail(`calculateLineTotals caso ${i + 1}`, 'outputs distintos');
            console.log('  OLD:', JSON.stringify(oldOut));
            console.log('  NEW:', JSON.stringify(newOut));
            allOk = false;
        }
    }
    if (allOk) ok('calculateLineTotals', `${inputs.length} casos idénticos`);
}

// ---- 5.2 calculateInvoiceTotals ----
{
    const cases = [
        [{ indicadorFacturacion: 1, lineBase: 100 }, { indicadorFacturacion: 1, lineBase: 200 }],
        [{ indicadorFacturacion: 1, lineBase: 100 }, { indicadorFacturacion: 2, lineBase: 100 }, { indicadorFacturacion: 4, lineBase: 50 }],
        [99.99, 99.99, 99.99, 99.99, 99.99].map(b => ({ indicadorFacturacion: 1, lineBase: b })),
        [],
    ];
    let allOk = true;
    for (let i = 0; i < cases.length; i++) {
        const oldOut = oldHelpers.calculateInvoiceTotals(cases[i]);
        const newOut = newHelpers.calculateInvoiceTotals(cases[i]);
        if (!deepEqual(oldOut, newOut)) {
            fail(`calculateInvoiceTotals caso ${i + 1}`, 'outputs distintos');
            allOk = false;
        }
    }
    if (allOk) ok('calculateInvoiceTotals', `${cases.length} casos idénticos`);
}

// ---- 5.3 buildInvoiceResponse ----
{
    const cases = [
        { toJSON: () => ({ id: 'a', ncf: 'E31', type: '31', status: 'draft', total: 100, trackId: null, xmlContent: '<x/>', xmlSigned: null, rfce: null }) },
        { toJSON: () => ({ id: 'b', ncf: 'E34', type: '34', status: 'signed', total: 100, trackId: 'T1', xmlContent: '<x/>', xmlSigned: '<s/>', rfce: null }) },
        { toJSON: () => ({ id: 'c', ncf: 'E32', type: '32', status: 'draft', total: 100, trackId: null, xmlContent: '<x/>', xmlSigned: null, rfce: { id: 'r1' } }) },
    ];
    let allOk = true;
    for (let i = 0; i < cases.length; i++) {
        const oldOut = oldHelpers.buildInvoiceResponse(cases[i]);
        const newOut = newHelpers.buildInvoiceResponse(cases[i]);
        if (!deepEqual(oldOut, newOut)) {
            fail(`buildInvoiceResponse caso ${i + 1}`, 'outputs distintos');
            allOk = false;
        }
    }
    if (allOk) ok('buildInvoiceResponse', `${cases.length} casos idénticos`);
}

// ---- 5.4 mapTransporteFields ----
{
    const cases = [
        null, {},
        { viaTransporte: '01', paisOrigen: 'DO', paisDestino: 'US' },
        { viaTransporte: '02', paisOrigen: 'DO', direccionDestino: 'X', paisDestino: 'US',
          rncCompaniaTransportista: '123', nombreCompaniaTransportista: 'ABC',
          numeroViaje: 'V1', conductor: 'Juan', documentoTransporte: 'D1',
          ficha: 'F1', placa: 'A123', rutaTransporte: 'R1', zonaTransporte: 'Z1',
          numeroAlbaran: 'A1' },
    ];
    let allOk = true;
    for (let i = 0; i < cases.length; i++) {
        const oldOut = oldHelpers.mapTransporteFields(cases[i]);
        const newOut = newHelpers.mapTransporteFields(cases[i]);
        if (!deepEqual(oldOut, newOut)) { fail(`mapTransporteFields caso ${i + 1}`); allOk = false; }
    }
    if (allOk) ok('mapTransporteFields', `${cases.length} casos idénticos`);
}

// ---- 5.5 mapInfoAdicionalFields ----
{
    const cases = [
        null, {},
        { fechaEmbarque: '2026-01-15', numeroEmbarque: 'E1' },
        { fechaEmbarque: '2026-01-15', numeroEmbarque: 'E1', numeroContenedor: 'C1',
          nombrePuertoEmbarque: 'P1', condicionesEntrega: 'FOB', totalFob: 100,
          seguro: 10, flete: 20, otrosGastos: 5, totalCif: 135, regimenAduanero: 'R1',
          nombrePuertoSalida: 'P2', nombrePuertoDesembarque: 'P3', numeroReferencia: 'REF1',
          pesoBruto: 1000, pesoNeto: 900, unidadPesoBruto: 1, unidadPesoNeto: 1,
          cantidadBulto: 10, unidadBulto: 2, volumenBulto: 5.5, unidadVolumen: 3 },
    ];
    let allOk = true;
    for (let i = 0; i < cases.length; i++) {
        const oldOut = oldHelpers.mapInfoAdicionalFields(cases[i]);
        const newOut = newHelpers.mapInfoAdicionalFields(cases[i]);
        if (!deepEqual(oldOut, newOut)) { fail(`mapInfoAdicionalFields caso ${i + 1}`); allOk = false; }
    }
    if (allOk) ok('mapInfoAdicionalFields', `${cases.length} casos idénticos`);
}

// ---- 5.6 calculateSubtotalsFromLines ----
{
    const subtotalesInput = [
        { numeroSubtotal: 1, descripcion: 'A', orden: 1 },
        { numeroSubtotal: 2, descripcion: 'B', orden: 2 },
    ];
    const calculatedLines = [
        { subtotalId: 1, indicadorFacturacion: 1, lineBase: 100, itbisAmount: 18, total: 118 },
        { subtotalId: 1, indicadorFacturacion: 4, lineBase: 50, itbisAmount: 0, total: 50 },
        { subtotalId: 2, indicadorFacturacion: 1, lineBase: 200, itbisAmount: 36, total: 236 },
    ];
    const oldOut = oldHelpers.calculateSubtotalsFromLines(subtotalesInput, calculatedLines);
    const newOut = newHelpers.calculateSubtotalsFromLines(subtotalesInput, calculatedLines);
    if (deepEqual(oldOut, newOut)) ok('calculateSubtotalsFromLines', '2 subtotales idénticos');
    else { fail('calculateSubtotalsFromLines', 'outputs distintos'); }
}

// ---- 5.7 assertSubtotalsMatchInvoiceTotal ----
{
    try {
        oldHelpers.assertSubtotalsMatchInvoiceTotal([{ montoSubTotal: 200 }, { montoSubTotal: 204 }], 404);
        newHelpers.assertSubtotalsMatchInvoiceTotal([{ montoSubTotal: 200 }, { montoSubTotal: 204 }], 404);
        ok('assertSubtotalsMatchInvoiceTotal (OK)');
    } catch (e) { fail('assertSubtotalsMatchInvoiceTotal (OK)', e.message); }

    let oldThrew = false, newThrew = false;
    try { oldHelpers.assertSubtotalsMatchInvoiceTotal([{ montoSubTotal: 100 }], 200); } catch (e) { oldThrew = true; }
    try { newHelpers.assertSubtotalsMatchInvoiceTotal([{ montoSubTotal: 100 }], 200); } catch (e) { newThrew = true; }
    if (oldThrew && newThrew) ok('assertSubtotalsMatchInvoiceTotal (mismatch throws)');
    else fail('assertSubtotalsMatchInvoiceTotal (mismatch)', `old=${oldThrew} new=${newThrew}`);
}

// ---- 5.8 calculateOtraMonedaTotals ----
{
    const lines = [
        { total: 118, unitPrice: 100, discount: 0, recargo: 0 },
        { total: 236, unitPrice: 200, discount: 0, recargo: 0 },
    ];
    const invoiceTotals = {
        montoGravado: 300, itbis1Base: 300, itbis2Base: 0, itbis3Base: 0,
        exemptAmount: 0, itbis: 54, itbis1Amount: 54, itbis2Amount: 0,
        itbis3Amount: 0, total: 354, montoImpuestoAdicional: 0
    };

    const oldOut1 = oldHelpers.calculateOtraMonedaTotals(lines.map(l => ({ ...l })), 58.5, invoiceTotals);
    const newOut1 = newHelpers.calculateOtraMonedaTotals(lines.map(l => ({ ...l })), 58.5, invoiceTotals);
    if (deepEqual(oldOut1, newOut1)) ok('calculateOtraMonedaTotals (con TC)');
    else fail('calculateOtraMonedaTotals (con TC)', 'outputs distintos');

    const oldOut2 = oldHelpers.calculateOtraMonedaTotals([], null, invoiceTotals);
    const newOut2 = newHelpers.calculateOtraMonedaTotals([], null, invoiceTotals);
    if (deepEqual(oldOut2, newOut2)) ok('calculateOtraMonedaTotals (sin TC)');
    else fail('calculateOtraMonedaTotals (sin TC)', 'outputs distintos');
}

// ---- 5.9 roundMoney4 ----
{
    const cases = [0, 1, 1.0001, 1.0005, 1.00005, 123.45678, -5.5];
    let allOk = true;
    for (const n of cases) {
        const oldOut = oldHelpers.roundMoney4(n);
        const newOut = newHelpers.roundMoney4(n);
        if (oldOut !== newOut) { fail(`roundMoney4(${n})`, `OLD ${oldOut} vs NEW ${newOut}`); allOk = false; }
    }
    if (allOk) ok('roundMoney4', `${cases.length} casos idénticos`);
}

// ============================================================
// 6. create/update: solo firma (comportamiento verificado en smoke tests)
// ============================================================
console.log('\n=== 6. create/update (firma + existencia) ===\n');

for (const key of ['createMyInvoice', 'updateMyInvoice']) {
    if (typeof oldS[key] === 'function' && typeof newS[key] === 'function') {
        if (oldS[key].length === newS[key].length) {
            ok(`${key}: firma OK`, `${oldS[key].length} args`);
        } else {
            fail(`${key}: firma distinta`);
        }
    } else {
        fail(`${key}: falta en uno de los dos`);
    }
}

// ============================================================
// RESULTADO
// ============================================================
console.log(`\n=== RESULTADO: ${passed}/${total} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);