// ============================================================
// Validaciones Joi para el módulo invoices
// Pendiente: agregar schemas cuando se implementen los endpoints
// ============================================================

const Joi = require('joi');

const listInvoicesQuerySchema = Joi.object({
    status: Joi.string()
        .valid('draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency')
        .optional(),
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    receiverRnc: Joi.string().max(15).optional(),
    ncf: Joi.string().max(20).optional(),
    hasTrackId: Joi.boolean().truthy('true').falsy('false').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
    listInvoicesQuerySchema
};

// Schemas planeados:
// - createInvoiceSchema
// - updateInvoiceSchema
// - createInvoiceLineSchema
// - updateInvoiceLineSchema
// - listInvoicesQuerySchema
// - listAllInvoicesQuerySchema
