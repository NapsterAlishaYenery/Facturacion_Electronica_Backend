// ============================================================
// constants.js
// Constantes del service de facturas.
// ============================================================

// Nombre legible del tipo de e-CF
const ECF_TYPE_NAMES = {
    '31': 'Factura de Crédito Fiscal Electrónica',
    '32': 'Factura de Consumo Electrónica',
    '33': 'Nota de Débito Electrónica',
    '34': 'Nota de Crédito Electrónica',
    '41': 'Comprobante de Compras Electrónico',
    '43': 'Gastos Menores Electrónico',
    '44': 'Regímenes Especiales Electrónico',
    '45': 'Gubernamental Electrónico',
    '46': 'Comprobante de Exportaciones Electrónico',
    '47': 'Comprobante para Pagos al Exterior Electrónico'
};

module.exports = { ECF_TYPE_NAMES };