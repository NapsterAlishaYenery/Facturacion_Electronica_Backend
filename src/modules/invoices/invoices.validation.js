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

    // 🔥 NUEVO: campos específicos de Notas de Débito/Crédito (33/34)
    // Solo se aceptan cuando type === 33 o 34. En cualquier otro tipo, forbidden.
    modifiedNcf: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().min(11).max(19).required()
            .messages({
                'any.required': 'NCFModificado is required for Notas (33/34)',
                'string.min': 'NCFModificado must be at least 11 characters',
                'string.max': 'NCFModificado cannot exceed 19 characters'
            }),
        otherwise: Joi.forbidden()
    }),
    modifiedNcfIssuerRnc: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().max(15).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),
    modifiedNcfDate: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.date().iso().required()
            .messages({
                'any.required': 'FechaNCFModificado is required for Notas (33/34)'
            }),
        otherwise: Joi.forbidden()
    }),
    modificationCode: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.number().integer().min(1).max(5).required()
            .messages({
                'any.required': 'CodigoModificacion is required for Notas (33/34)',
                'number.min': 'CodigoModificacion must be between 1 and 5',
                'number.max': 'CodigoModificacion must be between 1 and 5'
            }),
        otherwise: Joi.forbidden()
    }),
    modificationReason: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().max(90).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),

    // 🔥 NUEVO: campo específico del 34 (Nota de Crédito)
    indicadorNotaCredito: Joi.when('type', {
        is: '34',
        then: Joi.number().integer().valid(0, 1).required()
            .messages({
                'any.required': 'IndicadorNotaCredito is required for Nota de Crédito (34)',
                'any.only': 'IndicadorNotaCredito must be 0 or 1'
            }),
        otherwise: Joi.forbidden()
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

    // 🔥 NUEVO: coherencia del IndicadorNotaCredito con las fechas
    // Regla DGII:
    //   - 0 → nota emitida dentro de los 30 días de la factura original
    //   - 1 → nota emitida después de 30 días de la factura original
    if (value.type === '34' && value.modifiedNcfDate && value.indicadorNotaCredito !== undefined) {
        const modDate = new Date(value.modifiedNcfDate);
        const issuedDate = value.issuedAt ? new Date(value.issuedAt) : new Date();
        const diffDays = (issuedDate - modDate) / (1000 * 60 * 60 * 24);

        if (diffDays > 30 && value.indicadorNotaCredito !== 1) {
            return helpers.error('any.custom', {
                message: 'IndicadorNotaCredito must be 1 when the original NCF is more than 30 days old'
            });
        }
        if (diffDays <= 30 && value.indicadorNotaCredito !== 0) {
            return helpers.error('any.custom', {
                message: 'IndicadorNotaCredito must be 0 when the original NCF is 30 days old or less'
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
// ------------------------------------------------------------
// Schema: editar factura (company_admin)
// Solo permite editar mientras la factura esté en draft.
// Los campos de referencia de Notas (33/34) NO son editables.
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
        }),

    // 🔥 NUEVO: campos editables de Notas (33/34) — solo razón y código
    modificationCode: Joi.number().integer().min(1).max(5).optional()
        .messages({
            'number.min': 'CodigoModificacion must be between 1 and 5',
            'number.max': 'CodigoModificacion must be between 1 and 5'
        }),
    modificationReason: Joi.string().max(90).optional().allow(null, '')
        .messages({
            'string.max': 'Modification reason cannot exceed 90 characters'
        }),

    // 🔥 NUEVO: campos de referencia — NO editables nunca
    // Si el cliente los manda, Joi.forbidden() devuelve 400
    modifiedNcf: Joi.forbidden()
        .messages({
            'any.unknown': 'NCFModificado cannot be changed after creation'
        }),
    modifiedNcfIssuerRnc: Joi.forbidden()
        .messages({
            'any.unknown': 'RNCOtroContribuyente cannot be changed after creation'
        }),
    modifiedNcfDate: Joi.forbidden()
        .messages({
            'any.unknown': 'FechaNCFModificado cannot be changed after creation'
        }),
    indicadorNotaCredito: Joi.forbidden()
        .messages({
            'any.unknown': 'IndicadorNotaCredito cannot be changed after creation'
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

// ------------------------------------------------------------
// Schema: listar TODAS las facturas (admin)
// ------------------------------------------------------------
const listAllInvoicesQuerySchema = Joi.object({
    companyId: Joi.string().uuid().optional(),
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
    search: Joi.string().max(100).optional().allow(''),  // ← busca por RNC o nombre de empresa
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});


module.exports = {
    listInvoicesQuerySchema,
    createInvoiceSchema,
    updateInvoiceSchema,
    listAllInvoicesQuerySchema
};
