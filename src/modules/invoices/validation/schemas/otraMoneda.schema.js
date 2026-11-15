const Joi = require('joi');

// OtraMoneda — encabezado
const otraMonedaSchema = Joi.object({
    tipoMoneda: Joi.string().length(3).uppercase().optional().allow(null, '')
        .messages({ 'string.length': 'tipoMoneda must be 3 chars ISO 4217' }),
    tipoCambio: Joi.number().positive().optional().allow(null)
        .messages({ 'number.positive': 'tipoCambio must be > 0' }),
    montoGravadoTotalOtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado1OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado2OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado3OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoExentoOtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbisOtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis1OtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis2OtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis3OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoImpuestoAdicionalOtraMoneda: Joi.number().min(0).optional().allow(null),
    impuestosAdicionalesOtraMoneda: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required(),
            tasa: Joi.number().min(0).optional().allow(null),
            iscEspecifico: Joi.number().min(0).optional().allow(null),
            iscAdvalorem: Joi.number().min(0).optional().allow(null),
            otros: Joi.number().min(0).optional().allow(null)
        })
    ).max(20).optional().allow(null),
    montoTotalOtraMoneda: Joi.number().min(0).optional().allow(null)
});

module.exports = { otraMonedaSchema };