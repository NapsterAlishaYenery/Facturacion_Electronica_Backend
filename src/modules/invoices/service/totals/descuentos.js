// ============================================================
// descuentos.js
// DT33 — Descuentos y recargos GLOBALES.
//
// El cliente manda tipoValor ('%' o '$').
//   - tipoValor = '$' → se usa el monto del body.
//   - tipoValor = '%' → el service calcula sobre la base
//                       según indicadorFacturacion.
// ============================================================

const { roundMoney, roundPercent } = require('../helpers/round');
const { AppError } = require('../../../../shared/middlewares/error.middleware');

/**
 * Calcula el `monto` de un descuento/recargo cuando tipoValor = '%'.
 *
 * Base según indicadorFacturacion:
 *   1 → itbis1Base (18%)
 *   2 → itbis2Base (16%)
 *   3 → itbis3Base (0% gravado, exportación)
 *   4 → exemptAmount
 *
 * @param {Object} descuento - { indicadorFacturacion, valor, ... }
 * @param {Object} invoiceTotals - resultado de calculateInvoiceTotals
 * @returns {number} monto redondeado a 2 decimales
 * @throws {AppError} si indicadorFacturacion no es 1/2/3/4
 */
function calculateMontoForPercent(descuento, invoiceTotals) {
    const ind = Number(descuento.indicadorFacturacion);
    const valor = Number(descuento.valor);

    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
        throw new AppError(
            `Valor de descuento/recargo inválido: ${descuento.valor}. Debe ser > 0 y <= 100.`,
            400,
            'INVALID_DESCUENTO_VALOR'
        );
    }

    let base;
    if (ind === 1) base = Number(invoiceTotals.itbis1Base || 0);
    else if (ind === 2) base = Number(invoiceTotals.itbis2Base || 0);
    else if (ind === 3) base = Number(invoiceTotals.itbis3Base || 0);
    else if (ind === 4) base = Number(invoiceTotals.exemptAmount || 0);
    else throw new AppError(
        `indicadorFacturacion=${ind} no soportado para descuento/recargo con tipoValor='%'. Debe ser 1, 2, 3 o 4.`,
        400,
        'INVALID_INDICADOR_FACTURACION'
    );

    return roundMoney(base * (valor / 100));
}

/**
 * Aplica los descuentos/recargos globales a los totales de la factura.
 *
 * Reglas del PDF DGII v1.0 — Sección D:
 *
 *   1. Descuento (D) RESTA de la base según indicadorFacturacion.
 *   2. Recargo (R) SUMA a la base según indicadorFacturacion.
 *   3. Si indicadorNorma1007 = 1 (solo aplica a D):
 *      - NO se resta de la base gravada (itbisXBase / exemptAmount).
 *      - SÍ se resta del total (MontoTotal / ValorPagar).
 *   4. Se recalculan ITBIS por tasa sobre las nuevas bases.
 *   5. Se recalculan montoGravado, subtotal y total.
 */
function applyDescuentosToTotals(invoiceTotals, descuentos) {
    // Sin descuentos → no tocar nada (devolver el mismo objeto)
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return invoiceTotals;
    }

    // Copia defensiva: no mutamos el original
    const t = { ...invoiceTotals };

    // Acumuladores por base (en valor absoluto)
    let deltaItbis1Base = 0;
    let deltaItbis2Base = 0;
    let deltaItbis3Base = 0;
    let deltaExempt = 0;

    for (const d of descuentos) {
        const ind = Number(d.indicadorFacturacion);
        const monto = roundMoney(d.monto);
        // D resta, R suma
        const signo = d.tipoAjuste === 'D' ? -1 : 1;
        const montoSigned = signo * monto;

        // Regla IndicadorNorma1007 (solo aplica a descuentos):
        // si está en 1, NO se resta de la base gravada.
        // El descuento normativo solo afecta al ValorPagar (que no calculamos
        // en esta fase — queda como deuda para DT34).
        const isDescuento = d.tipoAjuste === 'D';
        const skipBase = isDescuento && Number(d.indicadorNorma1007) === 1;

        if (ind === 1) {
            if (!skipBase) deltaItbis1Base += montoSigned;
        } else if (ind === 2) {
            if (!skipBase) deltaItbis2Base += montoSigned;
        } else if (ind === 3) {
            if (!skipBase) deltaItbis3Base += montoSigned;
        } else if (ind === 4) {
            if (!skipBase) deltaExempt += montoSigned;
        } else {
            // No debería llegar aquí (validado en Joi y en calculateMontoForPercent)
            throw new AppError(
                `indicadorFacturacion=${ind} inválido al aplicar descuentos`,
                400,
                'INVALID_INDICADOR_FACTURACION'
            );
        }
    }

    // Aplicar deltas a las bases
    t.itbis1Base = roundMoney(Number(t.itbis1Base || 0) + deltaItbis1Base);
    t.itbis2Base = roundMoney(Number(t.itbis2Base || 0) + deltaItbis2Base);
    t.itbis3Base = roundMoney(Number(t.itbis3Base || 0) + deltaItbis3Base);
    t.exemptAmount = roundMoney(Number(t.exemptAmount || 0) + deltaExempt);

    // Recalcular ITBIS sobre las nuevas bases (tasa fija por indicador)
    t.itbis1Amount = roundMoney(t.itbis1Base * 0.18);
    t.itbis2Amount = roundMoney(t.itbis2Base * 0.16);
    t.itbis3Amount = roundMoney(t.itbis3Base * 0.00);
    t.itbis = roundMoney(t.itbis1Amount + t.itbis2Amount + t.itbis3Amount);

    // montoGravado = suma de bases gravadas (1, 2, 3)
    t.montoGravado = roundMoney(t.itbis1Base + t.itbis2Base + t.itbis3Base);

    // subtotal = suma de bases (gravadas + exentas)
    t.subtotal = roundMoney(t.montoGravado + t.exemptAmount);

    // total = bases + ITBIS recalculados
    // (NO usamos invoiceTotals.total + delta porque el ITBIS pudo cambiar)
    t.total = roundMoney(t.montoGravado + t.exemptAmount + t.itbis);

    return t;
}

/**
 * Calcula el ValorPagar cuando hay descuentos con indicadorNorma1007 = 1.
 *
 * Regla del PDF DGII:
 *   - Los descuentos con indicadorNorma1007 = 1 NO restan del MontoTotal
 *     (ni de la base gravada, ni del ITBIS).
 *   - Pero SÍ restan del ValorPagar.
 *
 * Fórmula:
 *   ValorPagar = MontoTotal - Σ(descuentos con indicadorNorma1007 = 1)
 */
function calculateValorPagarNorma1007(montoTotal, descuentos) {
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return null;
    }

    // Filtrar solo descuentos (D) con indicadorNorma1007 = 1
    const descuentosNorma1007 = descuentos.filter(d =>
        d.tipoAjuste === 'D' &&
        Number(d.indicadorNorma1007) === 1
    );

    if (descuentosNorma1007.length === 0) {
        return null;
    }

    const totalDescuentosNorma1007 = descuentosNorma1007.reduce(
        (sum, d) => sum + roundMoney(d.monto),
        0
    );

    return roundMoney(Number(montoTotal) - totalDescuentosNorma1007);
}

/**
 * Resuelve el `monto` final de un descuento/recargo antes de guardarlo:
 *
 *   - tipoValor = '$' → usa el monto del body (el cliente decidió).
 *   - tipoValor = '%' → el service lo calcula (ignora el monto del body si vino).
 *
 * Devuelve una copia del objeto descuento con el monto ya resuelto.
 */
function resolveDescuentoMonto(descuento, invoiceTotals) {
    const resolved = { ...descuento };

    if (descuento.tipoValor === '$') {
        // El cliente manda el monto; lo redondeamos por seguridad
        resolved.monto = roundMoney(Number(descuento.monto || 0));
    } else if (descuento.tipoValor === '%') {
        // El service calcula el monto a partir de la base real
        resolved.monto = calculateMontoForPercent(descuento, invoiceTotals);
    } else {
        throw new AppError(
            `tipoValor inválido: ${descuento.tipoValor}. Debe ser '%' o '$'.`,
            400,
            'INVALID_TIPO_VALOR'
        );
    }

    return resolved;
}

/**
 * Prepara el array de descuentos para guardar:
 *   1. Calcula el monto de cada uno (con las bases preliminares).
 *   2. Devuelve el array con montos resueltos.
 *
 * IMPORTANTE: se debe llamar ANTES de aplicar los descuentos a los totales,
 * porque necesitamos las bases preliminares para calcular los montos.
 */
function prepareDescuentos(descuentos, invoiceTotals) {
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return [];
    }
    return descuentos.map(d => resolveDescuentoMonto(d, invoiceTotals));
}

module.exports = {
    calculateMontoForPercent,
    applyDescuentosToTotals,
    calculateValorPagarNorma1007,
    resolveDescuentoMonto,
    prepareDescuentos,
    roundPercent  // re-export por si algún consumidor lo necesita directo
};