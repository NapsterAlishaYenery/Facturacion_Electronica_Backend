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

// ------------------------------------------------------------
// Schema: crear factura (company_admin)
// ------------------------------------------------------------
const createInvoiceSchema = Joi.object({
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .required()
        .messages({
            'any.required': 'Invoice type is required',
            'any.only': 'Type must be a valid e-CF type'
        }),
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver RNC cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver name cannot exceed 200 characters'
        }),
    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),
    items: Joi.array()
        .items(Joi.object({
            itemCode: Joi.string().max(50).optional().allow(null, ''),
            description: Joi.string().min(1).max(500).required()
                .messages({
                    'any.required': 'Item description is required',
                    'string.max': 'Item description cannot exceed 500 characters'
                }),
            quantity: Joi.number().positive().max(9999999.9999).required()
                .messages({
                    'number.positive': 'Item quantity must be greater than 0',
                    'any.required': 'Item quantity is required'
                }),
            unitPrice: Joi.number().min(0).max(9999999999.9999).required()
                .messages({
                    'number.min': 'Item unit price cannot be negative',
                    'any.required': 'Item unit price is required'
                }),
            discount: Joi.number().min(0).default(0)
                .messages({
                    'number.min': 'Item discount cannot be negative'
                }),
            itbisRate: Joi.number().min(0).max(100).default(18)
                .messages({
                    'number.min': 'ITBIS rate cannot be negative',
                    'number.max': 'ITBIS rate cannot exceed 100'
                })
        }))
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Invoice cannot have more than 100 items',
            'any.required': 'Items array is required'
        })
}).custom((value, helpers) => {
    // Validar issuedAt: máximo 30 días atrás, no futuro
    if (value.issuedAt) {
        const issuedAt = new Date(value.issuedAt);
        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (issuedAt > now) {
            return helpers.error('any.custom', {
                message: 'issuedAt cannot be in the future'
            });
        }
        if (issuedAt < thirtyDaysAgo) {
            return helpers.error('any.custom', {
                message: 'issuedAt cannot be more than 30 days in the past'
            });
        }
    }

    // Validación por línea: discount no puede superar el subtotal de la línea
    for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];
        const lineBase = (item.quantity * item.unitPrice) - item.discount;
        if (lineBase < 0) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
            });
        }
    }

    return value;
}).messages({
    'any.custom': '{{#message}}'
});

// ------------------------------------------------------------
// Schema: editar factura (company_admin)
// ------------------------------------------------------------
const updateInvoiceSchema = Joi.object({
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver RNC cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver name cannot exceed 200 characters'
        }),
    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),
    items: Joi.array()
        .items(Joi.object({
            itemCode: Joi.string().max(50).optional().allow(null, ''),
            description: Joi.string().min(1).max(500).required()
                .messages({
                    'any.required': 'Item description is required'
                }),
            quantity: Joi.number().positive().max(9999999.9999).required(),
            unitPrice: Joi.number().min(0).max(9999999999.9999).required(),
            discount: Joi.number().min(0).default(0),
            itbisRate: Joi.number().min(0).max(100).default(18)
        }))
        .min(1)
        .max(100)
        .optional()
        .messages({
            'array.min': 'If items are provided, at least one is required',
            'array.max': 'Invoice cannot have more than 100 items'
        })
}).min(1).messages({
    'object.min': 'At least one field is required to update'
}).custom((value, helpers) => {
    // Validar issuedAt (misma regla que en create)
    if (value.issuedAt) {
        const issuedAt = new Date(value.issuedAt);
        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (issuedAt > now) {
            return helpers.error('any.custom', { message: 'issuedAt cannot be in the future' });
        }
        if (issuedAt < thirtyDaysAgo) {
            return helpers.error('any.custom', { message: 'issuedAt cannot be more than 30 days in the past' });
        }
    }

    // Validación por línea: discount no puede superar el subtotal
    if (value.items) {
        for (let i = 0; i < value.items.length; i++) {
            const item = value.items[i];
            const lineBase = (item.quantity * item.unitPrice) - item.discount;
            if (lineBase < 0) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
                });
            }
        }
    }

    return value;
}).messages({
    'any.custom': '{{#message}}'
});

module.exports = {
    listInvoicesQuerySchema,
    createInvoiceSchema,
    updateInvoiceSchema
};

// Schemas planeados:
// - createInvoiceSchema
// - updateInvoiceSchema
// - createInvoiceLineSchema
// - updateInvoiceLineSchema
// - listInvoicesQuerySchema
// - listAllInvoicesQuerySchema
