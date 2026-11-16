// ============================================================
// otra-moneda.js
// DT-EXPORT — Cálculo de <OtraMoneda> (encabezado y detalle).
//
// Regla DGII (confirmada con el set E460000000007):
//   - Los montos en otra moneda se calculan DIVIDIENDO el monto
//     en DOP por el tipo de cambio.
//   - El precio unitario en otra moneda también se deriva
//     (unitPrice DOP / tipoCambio).
//   - Los TOTALES del encabezado se calculan SOBRE LOS TOTALES
//     DOP (no sumando líneas redondeadas) para evitar acumular
//     error de redondeo (ej: 2,061.41 vs 2,061.40).
// ============================================================

const { roundMoney, roundMoney4 } = require('../helpers/round');

/**
 * Enriquece cada línea con `precioOtraMoneda` y `montoItemOtraMoneda`
 * calculados desde DOP / tipoCambio, y devuelve los totales del
 * encabezado <OtraMoneda> calculados directo sobre los totales DOP.
 *
 * @param {Array}  calculatedLines   - líneas ya pasadas por calculateLineTotals
 *                                     (deben tener `total` y `unitPrice`)
 * @param {number} tipoCambio
 * @param {Object} invoiceTotalsDOP  - resultado de calculateInvoiceTotals
 * @returns {Object} totales para el <OtraMoneda> del encabezado
 *                   (todos null si no hay tipoCambio)
 */
function calculateOtraMonedaTotals(calculatedLines, tipoCambio, invoiceTotalsDOP) {
    const tc = Number(tipoCambio);

    // Sin tipo de cambio → no hay bloque OtraMoneda
    if (!tc || tc <= 0) {
        return {
            montoGravadoTotalOtraMoneda: null,
            montoGravado1OtraMoneda: null,
            montoGravado2OtraMoneda: null,
            montoGravado3OtraMoneda: null,
            montoExentoOtraMoneda: null,
            totalItbisOtraMoneda: null,
            totalItbis1OtraMoneda: null,
            totalItbis2OtraMoneda: null,
            totalItbis3OtraMoneda: null,
            montoImpuestoAdicionalOtraMoneda: null,
            montoTotalOtraMoneda: null,
            impuestosAdicionalesOtraMoneda: null,
        };
    }

    const r2 = roundMoney;
    const r4 = roundMoney4;

    // 1. Enriquecer cada línea con los valores derivados
    for (const line of calculatedLines) {
        const montoItemDOP = Number(line.total || 0);
        const unitPriceDOP = Number(line.unitPrice || 0);

        line.montoItemOtraMoneda = r2(montoItemDOP / tc);
        line.precioOtraMoneda = r4(unitPriceDOP / tc);

        // Descuento/recargo en otra moneda (si existen en DOP)
        line.descuentoOtraMoneda = Number(line.discount) > 0
            ? r2(Number(line.discount) / tc)
            : null;
        line.recargoOtraMoneda = Number(line.recargo) > 0
            ? r2(Number(line.recargo) / tc)
            : null;
    }

    // 2. Totales encabezado — directo desde los totales DOP
    return {
        montoGravadoTotalOtraMoneda: r2(invoiceTotalsDOP.montoGravado / tc),
        montoGravado1OtraMoneda: r2(invoiceTotalsDOP.itbis1Base / tc),
        montoGravado2OtraMoneda: r2(invoiceTotalsDOP.itbis2Base / tc),
        montoGravado3OtraMoneda: r2(invoiceTotalsDOP.itbis3Base / tc),
        montoExentoOtraMoneda: r2(invoiceTotalsDOP.exemptAmount / tc),
        totalItbisOtraMoneda: r2(invoiceTotalsDOP.itbis / tc),
        totalItbis1OtraMoneda: r2(invoiceTotalsDOP.itbis1Amount / tc),
        totalItbis2OtraMoneda: r2(invoiceTotalsDOP.itbis2Amount / tc),
        totalItbis3OtraMoneda: r2(invoiceTotalsDOP.itbis3Amount / tc),
        montoImpuestoAdicionalOtraMoneda: Number(invoiceTotalsDOP.montoImpuestoAdicional || 0) > 0
            ? r2(Number(invoiceTotalsDOP.montoImpuestoAdicional) / tc)
            : null,
        montoTotalOtraMoneda: r2(invoiceTotalsDOP.total / tc),
        // Deuda: impuestosAdicionalesOtraMoneda (requiere calcular ISC por línea en USD)
        impuestosAdicionalesOtraMoneda: null,
    };
}

module.exports = { calculateOtraMonedaTotals };