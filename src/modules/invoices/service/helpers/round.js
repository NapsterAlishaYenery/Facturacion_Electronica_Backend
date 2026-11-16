// ============================================================
// round.js
// Funciones de redondeo monetario y de porcentaje.
// Todas usan Number.EPSILON para evitar el bug clásico de floats:
//   1.005 → sin EPSILON da 1.00 (incorrecto), con EPSILON da 1.01 (correcto).
// ============================================================

/**
 * Redondeo monetario a 2 decimales con "half up".
 * Uso: TODO cálculo monetario del service pasa por aquí antes de guardar
 * en BD o de emitir en el XML. Nunca devolvemos floats "sucios" al modelo.
 */
function roundMoney(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondeo monetario a 2 decimales (variante usada en DT32 subtotales).
 * Misma aritmética que roundMoney; se mantiene separada por compatibilidad
 * con el código original donde se definió como `roundMoney2`.
 */
function roundMoney2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondeo a 4 decimales (para precios unitarios en otra moneda).
 * Se usa en <OtraMonedaDetalle> del <Item>.
 */
function roundMoney4(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}

/**
 * Redondeo de porcentaje a 2 decimales.
 * Semánticamente distinto de roundMoney, pero misma aritmética.
 */
function roundPercent(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = {
    roundMoney,
    roundMoney2,
    roundMoney4,
    roundPercent
};