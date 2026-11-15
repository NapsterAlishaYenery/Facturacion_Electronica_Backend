const Joi = require('joi');

// ============================================================
// DT33 — Sub-schema: Descuentos o Recargos globales (hasta 20)
// ============================================================
const descuentoORecargoSchema = Joi.object({
    numeroLinea: Joi.number().integer().min(1).max(20).required()
        .messages({
            'any.required': 'numeroLinea is required',
            'number.min': 'numeroLinea must be between 1 and 20',
            'number.max': 'numeroLinea must be between 1 and 20'
        }),
    tipoAjuste: Joi.string().valid('D', 'R').required()
        .messages({
            'any.required': 'tipoAjuste is required',
            'any.only': 'tipoAjuste must be "D" (descuento) or "R" (recargo)'
        }),
    indicadorNorma1007: Joi.number().integer().valid(1).optional().allow(null)
        .messages({
            'any.only': 'indicadorNorma1007 must be 1 or null'
        }),
    descripcion: Joi.string().max(45).optional().allow(null, '')
        .messages({
            'string.max': 'DescripcionDescuentooRecargo cannot exceed 45 characters'
        }),
    tipoValor: Joi.string().valid('%', '$').required()
        .messages({
            'any.required': 'tipoValor is required',
            'any.only': 'tipoValor must be "%" (porcentaje) or "$" (monto)'
        }),
    valor: Joi.when('tipoValor', {
        is: '%',
        then: Joi.number().positive().max(100).required()
            .messages({
                'any.required': 'valor is required when tipoValor is "%"',
                'number.positive': 'valor must be greater than 0 when tipoValor is "%"',
                'number.max': 'valor cannot exceed 100'
            }),
        otherwise: Joi.forbidden()
            .messages({ 'any.unknown': 'valor must not be provided when tipoValor is "$"' })
    }),
    monto: Joi.when('tipoValor', {
        is: '$',
        then: Joi.number().min(0).required()
            .messages({
                'any.required': 'monto is required when tipoValor is "$"',
                'number.min': 'monto cannot be negative'
            }),
        otherwise: Joi.number().min(0).optional().allow(null)
            .messages({ 'number.min': 'monto cannot be negative' })
    }),
    montoOtraMoneda: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'montoOtraMoneda cannot be negative' }),
    indicadorFacturacion: Joi.number().integer().valid(1, 2, 3, 4).required()
        .messages({
            'any.required': 'indicadorFacturacion is required',
            'any.only': 'indicadorFacturacion must be 1, 2, 3 or 4'
        })
});

module.exports = { descuentoORecargoSchema };