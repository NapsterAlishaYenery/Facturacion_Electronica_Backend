const Joi = require('joi');

// ============================================================
// DT30 — Sub-schemas reutilizables por sección del PDF DGII
// ============================================================

// IdDoc — campos extendidos
const idDocExtrasSchema = Joi.object({
    indicadorEnvioDiferido: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorEnvioDiferido must be 0 or 1' }),
    indicadorMontoGravado: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorMontoGravado must be 0 or 1' }),
    indicadorServicioTodoIncluido: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorServicioTodoIncluido must be 0 or 1' }),
    tipoIngresos: Joi.string().valid('01', '02', '03', '04', '05', '06').optional().allow(null)
        .messages({ 'any.only': 'tipoIngresos must be 01-06' }),
    tipoPago: Joi.number().integer().valid(1, 2, 3).optional().allow(null)
        .messages({ 'any.only': 'tipoPago must be 1 (Contado), 2 (Crédito) or 3 (Gratuito)' }),
    fechaLimitePago: Joi.date().iso().optional().allow(null),
    terminoPago: Joi.string().max(15).optional().allow(null, ''),
    formasPago: Joi.array().items(
        Joi.object({
            formaPago: Joi.number().integer().min(1).max(8).required()
                .messages({ 'number.min': 'formaPago must be 1-8', 'number.max': 'formaPago must be 1-8' }),
            montoPago: Joi.number().min(0).required()
                .messages({ 'number.min': 'montoPago cannot be negative' })
        })
    ).max(7).optional().allow(null)
        .messages({ 'array.max': 'formasPago cannot have more than 7 items' }),
    tipoCuentaPago: Joi.string().valid('CT', 'AH', 'OT').optional().allow(null)
        .messages({ 'any.only': 'tipoCuentaPago must be CT, AH or OT' }),
    numeroCuentaPago: Joi.string().max(28).optional().allow(null, ''),
    bancoPago: Joi.string().max(75).optional().allow(null, ''),
    fechaDesde: Joi.date().iso().optional().allow(null),
    fechaHasta: Joi.date().iso().optional().allow(null),
    totalPaginas: Joi.number().integer().min(1).optional().allow(null)
});

module.exports = { idDocExtrasSchema };