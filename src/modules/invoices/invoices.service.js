// ============================================================
// Servicio de facturas
// Pendiente: agregar funciones cuando se implementen los endpoints
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
    Company,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// Funciones planeadas:
// - listMyInvoices (company_admin)
// - getMyInvoiceById (company_admin)
// - createMyInvoice (company_admin)
// - updateMyInvoice (company_admin)
// - deleteMyInvoice (company_admin)
// - addLineToMyInvoice (company_admin)
// - updateLineOfMyInvoice (company_admin)
// - deleteLineOfMyInvoice (company_admin)
// - listAllInvoices (admin)
// - getInvoiceById (admin)

// Helpers internos:
// - buildInvoiceResponse
// - calculateInvoiceTotals
// - assignSequenceNumber (transaccional)
// - updateSequenceCurrentNumber

module.exports = {
    // Por ahora vacío
};