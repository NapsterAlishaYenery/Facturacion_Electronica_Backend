// ============================================================
// Validaciones Joi para el módulo POS (facturación rápida)
// ============================================================
//
// MVP: el POS SOLO emite tipos 31 y 32.
// Los demás tipos (33, 34, 41, 43, 44, 45, 46, 47) se manejan
// por /api/invoices/me con el formulario completo.
//
// taxType: solo 3 tratamientos del ITBIS (18, 16, EXENTO).
// ITBIS_3 (0% gravado / exportación) NO aplica al POS MVP.
//
// El POS acepta los campos DGII nuevos en las líneas manuales
// (indicadorBienoServicio, unidadMedida, gradosAlcohol, fechas,
// referencias) para que las facturas cumplan 100% con la DGII.
//
// La validación FINA fiscal la hace createInvoiceSchema en
// pos.service.createQuickInvoice (fuente de verdad).
// ============================================================

const Joi = require('joi');

// El POS SOLO emite 31 y 32
const POS_INVOICE_TYPES = ['31', '32'];

// Solo 3 tratamientos de ITBIS en el POS (sin ITBIS_3_46)
const POS_TAX_TYPES = ['ITBIS_18', 'ITBIS_16', 'EXENTO'];

// ============================================================
// Ítem del POS
// ============================================================

// Forma 1: producto del catálogo (productId + quantity)
// Los campos DGII se resuelven automáticamente desde el producto
// (pos.service.resolveCatalogItem).
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

// Forma 2: línea manual con todos los campos DGII
const manualItemSchema = Joi.object({
    // 🔥 FIX #1: permitir productId: null explícito (frontends que
    // mandan null para indicar "es manual"). NO se permite UUID aquí
    // porque eso sería ambiguo con catalogItemSchema.
    productId: Joi.any().valid(null).optional(),

    // Identificación
    itemName: Joi.string().min(1).max(80).required()
        .messages({
            'any.required': 'itemName is required for manual items',
            'string.max': 'itemName cannot exceed 80 characters'
        }),
    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({
            'string.max': 'description cannot exceed 1000 characters'
        }),
    itemCode: Joi.string().max(50).optional().allow(null, ''),

    // Naturaleza del ítem
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).default(1)
        .messages({
            'any.only': 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)'
        }),
    unidadMedida: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadMedida must be between 1 and 62',
            'number.max': 'unidadMedida must be between 1 and 62'
        }),

    // Cantidades y precios
    quantity: Joi.number().positive().max(9999999.9999).required()
        .messages({
            'any.required': 'quantity is required',
            'number.positive': 'quantity must be greater than 0'
        }),
    unitPrice: Joi.number().min(0).max(9999999999.9999).required()
        .messages({
            'any.required': 'unitPrice is required',
            'number.min': 'unitPrice cannot be negative'
        }),
    discount: Joi.number().min(0).default(0),
    recargo: Joi.number().min(0).default(0),

    // Referencias opcionales
    cantidadReferencia: Joi.number().min(0).optional().allow(null),
    unidadReferencia: Joi.number().integer().min(1).max(62).optional().allow(null),
    gradosAlcohol: Joi.number().min(0).max(100).optional().allow(null),
    precioUnitarioReferencia: Joi.number().min(0).optional().allow(null),
    fechaElaboracion: Joi.date().iso().optional().allow(null),
    fechaVencimientoItem: Joi.date().iso().optional().allow(null),

    // ITBIS: taxType (simplificado) o campos fiscales directos
    taxType: Joi.string().valid(...POS_TAX_TYPES).optional()
        .messages({
            'any.only': `taxType must be one of: ${POS_TAX_TYPES.join(', ')}`
        }),
    itbisRate: Joi.number().min(0).max(100).optional(),

    // 🔥 FIX #3: excluir indicadorFacturacion=3 (solo aplica a tipo 46,
    // que el POS no emite). Si el usuario necesita 0% gravado debe usar
    // /api/invoices/me tipo 46.
    indicadorFacturacion: Joi.number().integer().valid(0, 1, 2, 4).optional()
        .messages({
            'any.only': 'indicadorFacturacion must be 0, 1, 2, or 4 in POS (3 is only for type 46)'
        })

    // 🔥 FIX #2: ELIMINADO el campo `retencion`.
    // El POS solo emite 31/32, y createInvoiceSchema rechaza retencion
    // en tipos distintos a 41/47. Mantenerlo aquí solo producía un
    // error confuso desde invoices en lugar de rechazarlo en el POS.
})
    .or('taxType', 'itbisRate', 'indicadorFacturacion')
    .messages({
        'object.missing': 'Manual item requires taxType OR itbisRate/indicadorFacturacion'
    })
    .custom((item, helpers) => {
        // Reglas cruzadas DGII (idénticas a invoices.validation)
        const indicador = item.indicadorBienoServicio;

        // 🔥 FIX #5: si el ítem NO tiene indicadorBienoServicio, el default
        // es 1 (Bien). Pero como el default se aplica DESPUÉS de custom en
        // algunos casos, normalizamos:
        const indicadorEfectivo = indicador === undefined ? 1 : indicador;

        // (1) Bien requiere unidadMedida
        if (indicadorEfectivo === 1) {
            if (item.unidadMedida === undefined || item.unidadMedida === null) {
                return helpers.error('any.custom', {
                    message: 'unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.'
                });
            }
        }

        // (2) Servicio no permite gradosAlcohol
        if (indicadorEfectivo === 2
            && item.gradosAlcohol !== undefined
            && item.gradosAlcohol !== null) {
            return helpers.error('any.custom', {
                message: 'gradosAlcohol only applies to bienes, not servicios'
            });
        }

        // (3) cantidadReferencia ↔ unidadReferencia
        const hasCantRef = item.cantidadReferencia !== undefined && item.cantidadReferencia !== null;
        const hasUniRef = item.unidadReferencia !== undefined && item.unidadReferencia !== null;
        if (hasCantRef && !hasUniRef) {
            return helpers.error('any.custom', {
                message: 'unidadReferencia is required when cantidadReferencia is provided'
            });
        }
        if (hasUniRef && !hasCantRef) {
            return helpers.error('any.custom', {
                message: 'cantidadReferencia is required when unidadReferencia is provided'
            });
        }

        // (4) fechaVencimientoItem >= fechaElaboracion
        if (item.fechaElaboracion && item.fechaVencimientoItem) {
            const elab = new Date(item.fechaElaboracion);
            const venc = new Date(item.fechaVencimientoItem);
            if (venc < elab) {
                return helpers.error('any.custom', {
                    message: 'fechaVencimientoItem cannot be earlier than fechaElaboracion'
                });
            }
        }

        return item;
    })
    .messages({
        'any.custom': '{{#message}}'
    });

// 🔥 FIX #4: match('one') fuerza que el ítem sea EXACTAMENTE uno de los dos
// schemas (no ambos, no ninguno). Y el mensaje de error es claro cuando no
// calza con ninguno.
const posItemSchema = Joi.alternatives()
    .try(catalogItemSchema, manualItemSchema)
    .match('one')
    .messages({
        'alternatives.match': 'Item must be either a catalog item (productId+quantity) OR a manual item (itemName+quantity+unitPrice+tax info)'
    });

// ============================================================
// Schema: crear factura rápida (POST /api/pos/quick)
// ============================================================
const quickInvoiceSchema = Joi.object({
    type: Joi.string().valid(...POS_INVOICE_TYPES).required()
        .messages({
            'any.required': 'Invoice type is required',
            'any.only': `Type must be one of: ${POS_INVOICE_TYPES.join(', ')}`
        }),

    // Comprador nacional
    receiverRnc: Joi.string().max(15).optional().allow(null, ''),
    receiverName: Joi.string().max(200).optional().allow(null, ''),

    // Fecha
    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),

    // Líneas
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

        // 2. Tipo 31: RNC + Nombre obligatorios
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

        // 3. Tipo 32 con estimado ≥ 250K: RNC + Nombre obligatorios
        if (value.type === '32') {
            const estimado = value.items.reduce((sum, it) => {
                if (it.productId) return sum; // catálogo se resuelve después
                const base = (it.quantity || 0) * (it.unitPrice || 0)
                    - (it.discount || 0)
                    + (it.recargo || 0);
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