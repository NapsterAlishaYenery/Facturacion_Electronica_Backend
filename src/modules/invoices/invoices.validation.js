// ============================================================
// Validaciones Joi para el módulo invoices
// ============================================================

const Joi = require('joi');

// ============================================================
// Schemas de query
// ============================================================

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
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ============================================================
// Sub-schemas reutilizables
// ============================================================

// Item de línea — se usa en create y en update
const itemSchema = Joi.object({
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
});

// Transporte — solo aplica en tipos 31, 32, 33, 34, 44, 45, 46, 47
const transporteSchema = Joi.object({
    viaTransporte: Joi.string().valid('01', '02', '03').optional()
        .messages({
            'any.only': 'Via de transporte must be 01 (Terrestre), 02 (Marítimo) or 03 (Aérea)'
        }),
    paisOrigen: Joi.string().max(60).optional().allow(null, ''),
    direccionDestino: Joi.string().max(100).optional().allow(null, ''),
    paisDestino: Joi.string().max(60).optional().allow(null, ''),
    rncCompaniaTransportista: Joi.string().max(20).optional().allow(null, ''),
    nombreCompaniaTransportista: Joi.string().max(150).optional().allow(null, ''),
    numeroViaje: Joi.string().max(20).optional().allow(null, ''),
    conductor: Joi.string().max(20).optional().allow(null, ''),
    documentoTransporte: Joi.string().max(20).optional().allow(null, ''),
    ficha: Joi.string().max(10).optional().allow(null, ''),
    placa: Joi.string().max(7).optional().allow(null, ''),
    rutaTransporte: Joi.string().max(20).optional().allow(null, ''),
    zonaTransporte: Joi.string().max(20).optional().allow(null, ''),
    numeroAlbaran: Joi.string().max(20).optional().allow(null, '')
}).optional().allow(null);

// Informaciones adicionales — SOLO tipo 46 (exportación)
const informacionesAdicionalesSchema = Joi.object({
    fechaEmbarque: Joi.date().iso().optional().allow(null),
    numeroEmbarque: Joi.string().max(25).optional().allow(null, ''),
    numeroContenedor: Joi.string().max(100).optional().allow(null, ''),
    nombrePuertoEmbarque: Joi.string().max(40).optional().allow(null, ''),
    condicionesEntrega: Joi.string().max(3).optional().allow(null, ''),
    totalFob: Joi.number().min(0).optional().allow(null),
    seguro: Joi.number().min(0).optional().allow(null),
    flete: Joi.number().min(0).optional().allow(null),
    otrosGastos: Joi.number().min(0).optional().allow(null),
    totalCif: Joi.number().min(0).optional().allow(null),
    regimenAduanero: Joi.string().max(35).optional().allow(null, ''),
    nombrePuertoSalida: Joi.string().max(40).optional().allow(null, ''),
    nombrePuertoDesembarque: Joi.string().max(40).optional().allow(null, '')
}).optional().allow(null);

// ============================================================
// Schema: crear factura (company_admin)
// ============================================================

const createInvoiceSchema = Joi.object({
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .required()
        .messages({
            'any.required': 'Invoice type is required',
            'any.only': 'Type must be a valid e-CF type'
        }),

    // --- Comprador nacional ---
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver RNC cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver name cannot exceed 200 characters'
        }),

    // --- Comprador extranjero (46, 47) ---
    receiverIdentificadorExtranjero: Joi.when('type', {
        is: Joi.valid('46', '47'),
        then: Joi.string().max(20).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),
    receiverPais: Joi.when('type', {
        is: '46',
        then: Joi.string().max(60).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),

    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),

    // --- Notas de Débito/Crédito (33/34) ---
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

    // --- Nota de Crédito (34) ---
    indicadorNotaCredito: Joi.when('type', {
        is: '34',
        then: Joi.number().integer().valid(0, 1).required()
            .messages({
                'any.required': 'IndicadorNotaCredito is required for Nota de Crédito (34)',
                'any.only': 'IndicadorNotaCredito must be 0 or 1'
            }),
        otherwise: Joi.forbidden()
    }),

    // --- Monto exento (43, 44, 47) ---
    exemptAmount: Joi.when('type', {
        is: Joi.valid('43', '44', '47'),
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),

    // --- ITBIS3 (46) ---
    itbis3Base: Joi.when('type', {
        is: '46',
        then: Joi.number().min(0).required()
            .messages({ 'any.required': 'itbis3Base is required for e-CF 46' }),
        otherwise: Joi.forbidden()
    }),
    itbis3Amount: Joi.when('type', {
        is: '46',
        then: Joi.number().min(0).required()
            .messages({ 'any.required': 'itbis3Amount is required for e-CF 46' }),
        otherwise: Joi.forbidden()
    }),

    // --- Retención encabezado (41, 47) ---
    totalItbisRetenido: Joi.when('type', {
        is: '41',
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),
    totalIsrRetencion: Joi.when('type', {
        is: '47',
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),

    // --- Transporte (todos excepto 41, 43) ---
    transporte: Joi.when('type', {
        is: Joi.valid('31', '32', '33', '34', '44', '45', '46', '47'),
        then: transporteSchema,
        otherwise: Joi.forbidden()
    }),

    // --- Informaciones adicionales (solo 46) ---
    informacionesAdicionales: Joi.when('type', {
        is: '46',
        then: informacionesAdicionalesSchema,
        otherwise: Joi.forbidden()
    }),

    // --- Líneas ---
    items: Joi.array()
        .items(itemSchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Invoice cannot have more than 100 items',
            'any.required': 'Items array is required'
        })
})
    .custom((value, helpers) => {
        // 1. issuedAt: no futuro, no más de 30 días atrás
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

        // 2. Por línea: discount no puede superar quantity × unitPrice
        for (let i = 0; i < value.items.length; i++) {
            const item = value.items[i];
            const lineBase = (item.quantity * item.unitPrice) - item.discount;
            if (lineBase < 0) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
                });
            }
        }

        // 3. Coherencia IndicadorNotaCredito con fechas (regla DGII)
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

        // 4. Coherencia por tipo: comprador obligatorio/opcional
        const typeNeedsRnc = ['31', '41', '45'];
        const typeNeedsRazonSocial = ['31', '41', '44', '45', '46'];

        if (typeNeedsRnc.includes(value.type) && !value.receiverRnc) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverRnc`
            });
        }
        if (typeNeedsRazonSocial.includes(value.type) && !value.receiverName) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverName`
            });
        }

        // 5. 43 (Gastos Menores) no admite comprador
        if (value.type === '43' && (value.receiverRnc || value.receiverName)) {
            return helpers.error('any.custom', {
                message: 'Type 43 (Gastos Menores) cannot have a buyer'
            });
        }

        // 6. 46 / 47 requieren identificador extranjero si no hay RNC
        if ((value.type === '46' || value.type === '47')
            && !value.receiverRnc
            && !value.receiverIdentificadorExtranjero) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverRnc or receiverIdentificadorExtranjero`
            });
        }

        // 7. 46 requiere itbis3Base y itbis3Amount (ya forzado por Joi.when, doble check)
        if (value.type === '46') {
            if (value.itbis3Base === undefined || value.itbis3Base === null) {
                return helpers.error('any.custom', { message: 'Type 46 requires itbis3Base' });
            }
            if (value.itbis3Amount === undefined || value.itbis3Amount === null) {
                return helpers.error('any.custom', { message: 'Type 46 requires itbis3Amount' });
            }
        }

        return value;
    })
    .messages({
        'any.custom': '{{#message}}'
    });

// ============================================================
// Schema: editar factura (company_admin)
// Solo si status === 'draft'. Los campos de referencia NO son editables.
// ============================================================

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
        .items(itemSchema)
        .min(1)
        .max(100)
        .optional()
        .messages({
            'array.min': 'If items are provided, at least one is required',
            'array.max': 'Invoice cannot have more than 100 items'
        }),

    // Campos editables de Notas (33/34)
    modificationCode: Joi.number().integer().min(1).max(5).optional()
        .messages({
            'number.min': 'CodigoModificacion must be between 1 and 5',
            'number.max': 'CodigoModificacion must be between 1 and 5'
        }),
    modificationReason: Joi.string().max(90).optional().allow(null, '')
        .messages({
            'string.max': 'Modification reason cannot exceed 90 characters'
        }),

    // Campos NO editables nunca
    modifiedNcf: Joi.forbidden().messages({ 'any.unknown': 'NCFModificado cannot be changed after creation' }),
    modifiedNcfIssuerRnc: Joi.forbidden().messages({ 'any.unknown': 'RNCOtroContribuyente cannot be changed after creation' }),
    modifiedNcfDate: Joi.forbidden().messages({ 'any.unknown': 'FechaNCFModificado cannot be changed after creation' }),
    indicadorNotaCredito: Joi.forbidden().messages({ 'any.unknown': 'IndicadorNotaCredito cannot be changed after creation' }),

    // Campos de tipo / extranjero / transporte: NO editables
    type: Joi.forbidden(),
    receiverIdentificadorExtranjero: Joi.forbidden(),
    receiverPais: Joi.forbidden(),
    transporte: Joi.forbidden(),
    informacionesAdicionales: Joi.forbidden(),
    exemptAmount: Joi.forbidden(),
    itbis3Base: Joi.forbidden(),
    itbis3Amount: Joi.forbidden(),
    totalItbisRetenido: Joi.forbidden(),
    totalIsrRetencion: Joi.forbidden()
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required to update'
    })
    .custom((value, helpers) => {
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
    })
    .messages({
        'any.custom': '{{#message}}'
    });

module.exports = {
    listInvoicesQuerySchema,
    createInvoiceSchema,
    updateInvoiceSchema,
    listAllInvoicesQuerySchema
};