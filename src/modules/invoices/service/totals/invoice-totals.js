// ============================================================
// invoice-totals.js
// Calcula los totales de la factura completa a partir de las
// líneas ya calculadas.
//
// DT31-FIX — REGLA DGII (crítica):
// El ITBIS se calcula sobre la BASE IMPONIBLE TOTAL, no sumando
// el ITBIS redondeado de cada línea. Sumar los ITBIS por línea
// acumula errores de redondeo (ej: 5 líneas × 18% puede dar
// 2679.52 cuando la base total × 0.18 da 2679.53).
//
// La DGII valida en recepción:
//   TotalITBIS1 == round(MontoGravadoI1 × 0.18, 2)
// Si no coincide, rechaza el comprobante.
// ============================================================

// ------------------------------------------------------------
// Helper: calcular totales de la factura completa
// ------------------------------------------------------------
function calculateInvoiceTotals(lines) {
    let itbis1Base = 0;
    let itbis2Base = 0;
    let itbis3Base = 0;
    let exemptAmount = 0;

    for (const line of lines) {
        const ind = Number(line.indicadorFacturacion);
        const base = Number(line.lineBase);

        if (ind === 1) itbis1Base += base;
        else if (ind === 2) itbis2Base += base;
        else if (ind === 3) itbis3Base += base;
        else if (ind === 4) exemptAmount += base;
    }

    const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

    const itbis1Amount = round(itbis1Base * 0.18);
    const itbis2Amount = round(itbis2Base * 0.16);
    const itbis3Amount = round(itbis3Base * 0.00);

    const montoGravado = round(itbis1Base + itbis2Base + itbis3Base);
    const itbis = round(itbis1Amount + itbis2Amount + itbis3Amount);

    const subtotal = round(montoGravado + exemptAmount);
    const total = round(montoGravado + exemptAmount + itbis);

    // BD exige NOT NULL → guardamos 0 (no null).
    // El mapper (xml-integrator) decide si emitir o no el tag en el XML
    // basándose en si la base > 0, no en el valor crudo.
    return {
        montoGravado,
        itbis1Base: round(itbis1Base),
        itbis1Amount,
        itbis2Base: round(itbis2Base),
        itbis2Amount,
        itbis3Base: round(itbis3Base),
        itbis3Amount,
        exemptAmount: round(exemptAmount),
        subtotal,
        itbis,
        total
    };
}

module.exports = { calculateInvoiceTotals };