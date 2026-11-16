// ============================================================
// subtotals.js
// DT32 — Subtotales informativos (<Subtotales> del XML).
//
// El cliente solo manda la metadata de los grupos (numeroSubtotal,
// descripcion, orden) y marca cada línea con `subtotalId`.
// El SERVICE calcula los montos sumando las líneas del grupo.
// ============================================================

const { roundMoney2 } = require('../helpers/round');
const { AppError } = require('../../../../shared/middlewares/error.middleware');

/**
 * Calcula los subtotales a partir de las líneas ya calculadas.
 *
 * @param {Array} subtotalesInput - [{ numeroSubtotal, descripcion, orden }]
 * @param {Array} calculatedLines - líneas ya pasadas por calculateLineTotals
 *                                  (deben tener `subtotalId` y `lineBase`,
 *                                  `itbisAmount`, `indicadorFacturacion`, `total`)
 * @returns {Array} subtotales con montos calculados, listos para bulkCreate
 */
function calculateSubtotalsFromLines(subtotalesInput, calculatedLines) {
    if (!Array.isArray(subtotalesInput) || subtotalesInput.length === 0) {
        return [];
    }

    const lines = Array.isArray(calculatedLines) ? calculatedLines : [];

    return subtotalesInput.map((st) => {
        const numero = Number(st.numeroSubtotal);
        const lineasDelGrupo = lines.filter(
            (l) => l.subtotalId !== null
                && l.subtotalId !== undefined
                && Number(l.subtotalId) === numero
        );

        let montoGravadoI1 = 0;
        let montoGravadoI2 = 0;
        let montoGravadoI3 = 0;
        let subTotalItbis1 = 0;
        let subTotalItbis2 = 0;
        let subTotalItbis3 = 0;
        let subTotalExento = 0;
        let montoSubTotal = 0;

        for (const line of lineasDelGrupo) {
            const ind = Number(line.indicadorFacturacion);
            const base = Number(line.lineBase || 0);
            const itbis = Number(line.itbisAmount || 0);

            if (ind === 1) {
                montoGravadoI1 += base;
                subTotalItbis1 += itbis;
            } else if (ind === 2) {
                montoGravadoI2 += base;
                subTotalItbis2 += itbis;
            } else if (ind === 3) {
                montoGravadoI3 += base;
                subTotalItbis3 += itbis;
            } else if (ind === 4) {
                subTotalExento += base;
            }
            // ind === 0 (No Facturable) no suma a bases, solo al total

            montoSubTotal += Number(line.total || 0);
        }

        const montoGravadoTotal = montoGravadoI1 + montoGravadoI2 + montoGravadoI3;
        const subTotalItbis = subTotalItbis1 + subTotalItbis2 + subTotalItbis3;

        return {
            numeroSubtotal: numero,
            descripcion: st.descripcion || null,
            orden: st.orden ?? null,
            lineas: lineasDelGrupo.length,
            montoGravadoTotal: roundMoney2(montoGravadoTotal),
            montoGravadoI1: roundMoney2(montoGravadoI1),
            montoGravadoI2: roundMoney2(montoGravadoI2),
            montoGravadoI3: roundMoney2(montoGravadoI3),
            subTotalItbis: roundMoney2(subTotalItbis),
            subTotalItbis1: roundMoney2(subTotalItbis1),
            subTotalItbis2: roundMoney2(subTotalItbis2),
            subTotalItbis3: roundMoney2(subTotalItbis3),
            subTotalImpuestoAdicional: 0, // ver nota en el original
            subTotalExento: roundMoney2(subTotalExento),
            montoSubTotal: roundMoney2(montoSubTotal)
        };
    });
}

/**
 * Valida que la suma de subtotales cuadre con el total de la factura.
 * Lanza AppError si no cuadra (tolerancia 1 centavo por redondeo).
 */
function assertSubtotalsMatchInvoiceTotal(subtotalesCalculados, invoiceTotal) {
    if (!Array.isArray(subtotalesCalculados) || subtotalesCalculados.length === 0) {
        return;
    }
    const sumaSubtotales = subtotalesCalculados.reduce(
        (s, st) => s + Number(st.montoSubTotal || 0),
        0
    );
    const totalFactura = Number(invoiceTotal || 0);
    if (Math.abs(roundMoney2(sumaSubtotales) - roundMoney2(totalFactura)) > 0.01) {
        throw new AppError(
            `Los subtotales (${roundMoney2(sumaSubtotales)}) no cuadran con el total de la factura (${roundMoney2(totalFactura)}). Cada línea debe estar asignada a exactamente un subtotal.`,
            409,
            'SUBTOTALS_MISMATCH'
        );
    }
}

module.exports = {
    calculateSubtotalsFromLines,
    assertSubtotalsMatchInvoiceTotal
};