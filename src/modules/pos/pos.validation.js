// ============================================================
// Validaciones Joi para el módulo POS (facturación rápida)
// ============================================================
//
// El POS es un "shape reducido + traducción" del endpoint
// POST /api/invoices/me. Acepta los 10 tipos de e-CF y los 4
// taxType (ITBIS_18, ITBIS_16, ITBIS_3, EXENTO).
//
// La validación FINA por tipo (transporte, informacionesAdicionales,
// retenciones, ITBIS3, modifiedNcf, etc.) NO se duplica aquí:
// se hace en pos.service.createQuickInvoice llamando directamente
// a createInvoiceSchema.validate() sobre el payload ya traducido.
//
// Este schema solo valida:
//   - Forma del body del POS (type, receiver*, items)
//   - Reglas de alto nivel que queremos fallar rápido (31 → RNC+Nombre,
//     32 ≥ 250K → RNC+Nombre)
//   - Alternativas de item (productId vs línea manual)
// ============================================================

const Joi = require('joi');

// Los 4 tratamientos de ITBIS que el POS puede enviar.
// ITBIS_3 corresponde a indicadorFacturacion=3 (0% gravado,
// exclusivo de e-CF 46). createInvoiceSchema lo re-validará
// contra el tipo real.
const POS_TAX_TYPES = ['ITBIS_18', 'ITBIS_16', 'ITBIS_3', 'EXENTO'];

// Los 10 tipos de e-CF que el sistema soporta.
const POS_INVOICE_TYPES = [
    '31', '32', '33', '34', '41',
    '43', '44', '45', '46', '47'
];

// ============================================================
// Ítem del POS
// ============================================================

// Forma 1: producto del catálogo (solo productId + quantity)
const catalogItemSchema = Joi.object({
    productId: Joi.string().uuid().required()
        .messages({
            'any.required': 'productId is required for catalog items',
            'string.uuid': 'productId must be a valid UUID'
        }),
    quantity: Joi.number().positive().max(9999999.9999).required()
        .messages({
            'any.required': 'quantity is required',
            'number.positive': 'quantity must be greater than 0'
        })
});

// Forma 2: línea manual
// Acepta taxType (POS simplificado) O los campos fiscales
// directos (itbisRate, indicadorFacturacion) para máxima
// flexibilidad. Si vienen ambos, taxType manda (el servicio
// lo traduce y sobreescribe itbisRate/indicador).
const manualItemSchema = Joi.object({
    description: Joi.string().min(1).max(500).required()
        .messages({
            'any.required': 'description is required for manual items',
            'string.max': 'description cannot exceed 500 characters'
        }),
    unitPrice: Joi.number().min(0).max(9999999999.9999).required()
        .messages({
            'any.required': 'unitPrice is required for manual items',
            'number.min': 'unitPrice cannot be negative'
        }),
    quantity: Joi.number().positive().max(9999999.9999).required()
        .messages({
            'any.required': 'quantity is required',
            'number.positive': 'quantity must be greater than 0'
        }),

    // taxType simplificado (traduce el servicio)
    taxType: Joi.string().valid(...POS_TAX_TYPES).optional()
        .messages({
            'any.only': `taxType must be one of: ${POS_TAX_TYPES.join(', ')}`
        }),

    // Campos fiscales directos (alternativa a taxType; el
    // servicio los respeta tal cual si taxType no viene)
    itbisRate: Joi.number().min(0).max(100).optional(),
    indicadorFacturacion: Joi.number().integer().valid(0, 1, 2, 3, 4).optional(),

    // Campos opcionales de la línea fiscal (compatibilidad con createInvoiceSchema)
    itemCode: Joi.string().max(50).optional().allow(null, ''),
    discount: Joi.number().min(0).default(0),
    retencion: Joi.object({
        indicador: Joi.number().integer().valid(1, 2).required(),
        montoItbisRetenido: Joi.number().min(0).optional().allow(null),
        montoIsrRetenido: Joi.number().min(0).optional().allow(null)
    }).optional().allow(null)
})
    .or('taxType', 'itbisRate', 'indicadorFacturacion')
    .messages({
        'object.missing': 'Manual item requires taxType OR itbisRate/indicadorFacturacion'
    });

const posItemSchema = Joi.alternatives().try(
    catalogItemSchema,
    manualItemSchema
);

// ============================================================
// Schema: crear factura rápida (POST /api/pos/quick)
// ============================================================
const quickInvoiceSchema = Joi.object({
    type: Joi.string().valid(...POS_INVOICE_TYPES).required()
        .messages({
            'any.required': 'Invoice type is required',
            'any.only': `Type must be one of: ${POS_INVOICE_TYPES.join(', ')}`
        }),

    // --- Comprador nacional ---
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'receiverRnc cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'receiverName cannot exceed 200 characters'
        }),

    // --- Comprador extranjero (46, 47) ---
    receiverIdentificadorExtranjero: Joi.string().max(20).optional().allow(null, ''),
    receiverPais: Joi.string().max(60).optional().allow(null, ''),

    // --- Fechas ---
    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),

    // --- Notas (33/34) ---
    modifiedNcf: Joi.string().min(11).max(19).optional(),
    modifiedNcfIssuerRnc: Joi.string().max(15).optional().allow(null, ''),
    modifiedNcfDate: Joi.date().iso().optional(),
    modificationCode: Joi.number().integer().min(1).max(5).optional(),
    modificationReason: Joi.string().max(90).optional().allow(null, ''),
    indicadorNotaCredito: Joi.number().integer().valid(0, 1).optional(),

    // --- Montos especiales por tipo ---
    exemptAmount: Joi.number().min(0).optional(),
    itbis3Base: Joi.number().min(0).optional(),
    itbis3Amount: Joi.number().min(0).optional(),
    totalItbisRetenido: Joi.number().min(0).optional(),
    totalIsrRetencion: Joi.number().min(0).optional(),

    // --- Transporte / info adicional ---
    // (aceptamos cualquier objeto; createInvoiceSchema lo re-valida
    //  con su schema detallado por tipo)
    transporte: Joi.object().optional().allow(null),
    informacionesAdicionales: Joi.object().optional().allow(null),

    // --- Líneas ---
    items: Joi.array()
        .items(posItemSchema)
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

        // 2. Tipo 31: RNC + Nombre obligatorios (regla de alto nivel,
        //    createInvoiceSchema también lo valida, pero fallamos rápido)
        if (value.type === '31') {
            if (!value.receiverRnc) {
                return helpers.error('any.custom', {
                    message: 'Type 31 requires receiverRnc'
                });
            }
            if (!value.receiverName) {
                return helpers.error('any.custom', {
                    message: 'Type 31 requires receiverName'
                });
            }
        }

        // 3. Tipo 32 con estimado ≥ 250K: RNC + Nombre obligatorios.
        //    Estimación solo con líneas manuales (productos se
        //    resuelven después). createInvoiceSchema re-valida
        //    con el total real.
        if (value.type === '32') {
            const estimado = value.items.reduce((sum, it) => {
                if (it.productId) return sum;
                const base = (it.quantity || 0) * (it.unitPrice || 0);
                const rate = it.taxType === 'ITBIS_18' ? 0.18
                    : it.taxType === 'ITBIS_16' ? 0.16
                    : it.itbisRate != null ? it.itbisRate / 100
                    : 0;
                return sum + base * (1 + rate);
            }, 0);

            if (estimado >= 250000) {
                if (!value.receiverRnc) {
                    return helpers.error('any.custom', {
                        message: 'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)'
                    });
                }
                if (!value.receiverName) {
                    return helpers.error('any.custom', {
                        message: 'Type 32 with total >= 250,000 requires receiverName (DGII rule)'
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
    quickInvoiceSchema,
    POS_TAX_TYPES,
    POS_INVOICE_TYPES
};