const Joi = require('joi');

// Item de línea — se usa en create y en update
const itemSchema = Joi.object({
    // ---------- Identificación ----------
    itemCode: Joi.string().max(50).optional().allow(null, ''),

    // DT31 — <TablaCodigosItem> (hasta 5)
    additionalCodes: Joi.array().items(
        Joi.object({
            tipoCodigo: Joi.string().valid('Interna', 'EAN', 'PLU', 'DUN').optional()
                .messages({ 'any.only': 'tipoCodigo must be Interna, EAN, PLU or DUN' }),
            codigoItem: Joi.string().max(35).required()
                .messages({
                    'any.required': 'additionalCodes[].codigoItem is required',
                    'string.max': 'additionalCodes[].codigoItem cannot exceed 35 characters'
                })
        })
    ).max(5).optional().allow(null)
        .messages({ 'array.max': 'additionalCodes cannot have more than 5 items' }),

    // NombreItem (obligatorio DGII, máx 80 chars)
    itemName: Joi.string().min(1).max(80).required()
        .messages({
            'any.required': 'Item name (itemName) is required',
            'string.min': 'Item name cannot be empty',
            'string.max': 'Item name cannot exceed 80 characters'
        }),

    // DescripcionItem (opcional DGII, máx 1000 chars)
    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({ 'string.max': 'Item description cannot exceed 1000 characters' }),

    // ---------- Naturaleza del ítem ----------
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).default(1)
        .messages({ 'any.only': 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)' }),

    unidadMedida: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadMedida must be between 1 and 62',
            'number.max': 'unidadMedida must be between 1 and 62'
        }),

    // ---------- Cantidades y precios ----------
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
        .messages({ 'number.min': 'Item discount cannot be negative' }),
    recargo: Joi.number().min(0).default(0)
        .messages({ 'number.min': 'Item recargo cannot be negative' }),

    // ---------- Referencias opcionales ----------
    cantidadReferencia: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'cantidadReferencia cannot be negative' }),
    unidadReferencia: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadReferencia must be between 1 and 62',
            'number.max': 'unidadReferencia must be between 1 and 62'
        }),
    gradosAlcohol: Joi.number().min(0).max(100).optional().allow(null)
        .messages({
            'number.min': 'gradosAlcohol cannot be negative',
            'number.max': 'gradosAlcohol cannot exceed 100'
        }),
    precioUnitarioReferencia: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'precioUnitarioReferencia cannot be negative' }),
    fechaElaboracion: Joi.date().iso().optional().allow(null),
    fechaVencimientoItem: Joi.date().iso().optional().allow(null),

    // ═══════════════════════════════════════════════════════════
    // DT-EXPORT — Campos derivados del <OtraMonedaDetalle>
    // El sistema los calcula desde unitPrice / tipoCambio
    // y desde montoItem DOP / tipoCambio. El cliente NO los manda.
    // ═══════════════════════════════════════════════════════════
    precioOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'precioOtraMoneda se calcula automáticamente (unitPrice / tipoCambio). No lo envíes.' }),
    montoItemOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoItemOtraMoneda se calcula automáticamente (montoItem DOP / tipoCambio). No lo envíes.' }),

    // Estos dos siguen siendo input de negocio (descuento/recargo
    // aplicado en la moneda extranjera). Si en el futuro los quieres
    // derivar también, cámbialos a forbidden.
    descuentoOtraMoneda: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'descuentoOtraMoneda cannot be negative' }),
    recargoOtraMoneda: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'recargoOtraMoneda cannot be negative' }),

    // ---------- DT31 — Subcantidades (hasta 5) ----------
    subcantidades: Joi.array().items(
        Joi.object({
            subcantidad: Joi.number().min(0).required()
                .messages({ 'any.required': 'subcantidades[].subcantidad is required' }),
            codigoSubcantidad: Joi.number().integer().min(1).max(62).required()
                .messages({
                    'any.required': 'subcantidades[].codigoSubcantidad is required',
                    'number.min': 'codigoSubcantidad must be 1-62',
                    'number.max': 'codigoSubcantidad must be 1-62'
                })
        })
    ).max(5).optional().allow(null)
        .messages({ 'array.max': 'subcantidades cannot have more than 5 items' }),

    // ---------- DT31 — SubDescuentos (hasta 12) ----------
    subDescuentos: Joi.array().items(
        Joi.object({
            tipoSubDescuento: Joi.string().valid('$', '%').required()
                .messages({ 'any.only': 'tipoSubDescuento must be "$" or "%"' }),
            subDescuentoPorcentaje: Joi.number().min(0).max(100).when('tipoSubDescuento', {
                is: '%',
                then: Joi.required(),
                otherwise: Joi.optional().allow(null)
            }),
            montoSubDescuento: Joi.number().min(0).required()
                .messages({ 'any.required': 'montoSubDescuento is required' })
        })
    ).max(12).optional().allow(null)
        .messages({ 'array.max': 'subDescuentos cannot have more than 12 items' }),

    // ---------- DT31 — SubRecargos (hasta 12) ----------
    subRecargos: Joi.array().items(
        Joi.object({
            tipoSubRecargo: Joi.string().valid('$', '%').required()
                .messages({ 'any.only': 'tipoSubRecargo must be "$" or "%"' }),
            subRecargoPorcentaje: Joi.number().min(0).max(100).when('tipoSubRecargo', {
                is: '%',
                then: Joi.required(),
                otherwise: Joi.optional().allow(null)
            }),
            montoSubRecargo: Joi.number().min(0).required()
                .messages({ 'any.required': 'montoSubRecargo is required' })
        })
    ).max(12).optional().allow(null)
        .messages({ 'array.max': 'subRecargos cannot have more than 12 items' }),

    // ---------- DT31 — Impuestos adicionales por ítem (hasta 2) ----------
    impuestosAdicionales: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required()
                .messages({
                    'string.pattern.base': 'impuestosAdicionales[].codigo must be 3 digits (001-039)',
                    'any.required': 'impuestosAdicionales[].codigo is required'
                })
        })
    ).max(2).optional().allow(null)
        .messages({ 'array.max': 'impuestosAdicionales cannot have more than 2 items' }),

    // ---------- DT31 — Minería ----------
    pesoNetoKilogramo: Joi.number().min(0).optional().allow(null),
    pesoNetoMineria: Joi.number().min(0).optional().allow(null),
    tipoAfiliacion: Joi.number().integer().valid(1, 2).optional().allow(null),
    liquidacion: Joi.number().integer().valid(1, 2).optional().allow(null),

    // ---------- DT32 — Subtotal informativo (<Subtotales> del XML) ----------
    // El cliente marca esta línea como perteneciente al subtotal N.
    // NULL/undefined = la línea no entra en ningún subtotal (válido).
    // El service calcula los montos del subtotal sumando las líneas
    // que comparten el mismo subtotalId.
    subtotalId: Joi.number().integer().min(1).max(20).optional().allow(null)
        .messages({
            'number.min': 'subtotalId must be between 1 and 20',
            'number.max': 'subtotalId must be between 1 and 20'
        }),

    // ---------- ITBIS ----------
    indicadorFacturacion: Joi.number().integer().valid(0, 1, 2, 3, 4).optional()
        .messages({ 'any.only': 'indicadorFacturacion must be 0-4' }),
    itbisRate: Joi.number().min(0).max(100).default(18)
        .messages({
            'number.min': 'ITBIS rate cannot be negative',
            'number.max': 'ITBIS rate cannot exceed 100'
        }),

    // ---------- Retenciones (41, 47) ----------
    retencion: Joi.object({
        indicador: Joi.number().integer().valid(1, 2).required()
            .messages({ 'any.required': 'Retencion.indicador is required' }),
        montoItbisRetenido: Joi.number().min(0).optional().allow(null),
        montoIsrRetenido: Joi.number().min(0).optional().allow(null)
    }).optional().allow(null)
});

module.exports = { itemSchema };