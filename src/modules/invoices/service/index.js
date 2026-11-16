// ============================================================
// service/index.js
// Barrel del service de facturas.
// Exporta la misma API pública que invoices.service.js original,
// incluyendo el bloque _helpers para internalBilling.
// ============================================================

// Métodos públicos
const { listMyInvoices, listAllInvoices } = require('./list.service');
const { getMyInvoiceById, getInvoiceById } = require('./get.service');
const { createMyInvoice } = require('./create.service');
const { updateMyInvoice } = require('./update.service');
const { deleteMyInvoice } = require('./delete.service');
const { getMyInvoicePDF } = require('./pdf.service');
const { getMyInvoiceXML, getMyInvoiceRFCEXML } = require('./xml.service');
const { signMyInvoice } = require('./sign.service');

// Helpers reutilizables (para internalBilling y otros consumidores)
const { assignNextNCF } = require('./ncf/assign-next-ncf');
const { resolveModifiedInvoice } = require('./ncf/build-reference');
const { calculateLineTotals } = require('./build/invoice-lines.builder');
const { buildInvoiceResponse } = require('./build/invoice-response.builder');
const { mapTransporteFields } = require('./helpers/mappers/transporte.mapper');
const { mapInfoAdicionalFields } = require('./helpers/mappers/info-adicional.mapper');
const { calculateInvoiceTotals } = require('./totals/invoice-totals');
const { calculateSubtotalsFromLines, assertSubtotalsMatchInvoiceTotal } = require('./totals/subtotals');
const { calculateOtraMonedaTotals } = require('./totals/otra-moneda');
const { roundMoney4 } = require('./helpers/round');

module.exports = {
    listMyInvoices,
    getMyInvoiceById,
    createMyInvoice,
    updateMyInvoice,
    deleteMyInvoice,
    listAllInvoices,
    getInvoiceById,
    getMyInvoicePDF,
    getMyInvoiceXML,
    getMyInvoiceRFCEXML,
    signMyInvoice,

    // Helpers reutilizables para internalBilling
    _helpers: {
        assignNextNCF,
        calculateLineTotals,
        calculateInvoiceTotals,
        buildInvoiceResponse,
        mapTransporteFields,
        mapInfoAdicionalFields,
        resolveModifiedInvoice,
        // DT32 — subtotales
        calculateSubtotalsFromLines,
        assertSubtotalsMatchInvoiceTotal,
        // DT-EXPORT — OtraMoneda
        calculateOtraMonedaTotals,
        roundMoney4
    }
};