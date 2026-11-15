const Joi = require('joi');

// Totales — extendido (impuestos adicionales, montos extra)
const totalesExtrasSchema = Joi.object({
    montoImpuestoAdicional: Joi.number().min(0).optional().allow(null),
    impuestosAdicionales: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required()
                .messages({ 'string.pattern.base': 'impuestosAdicionales[].codigo must be 3 digits (001-039)' }),
            tasa: Joi.number().min(0).optional().allow(null),
            iscEspecifico: Joi.number().min(0).optional().allow(null),
            iscAdvalorem: Joi.number().min(0).optional().allow(null),
            otros: Joi.number().min(0).optional().allow(null)
        })
    ).max(20).optional().allow(null)
        .messages({ 'array.max': 'impuestosAdicionales cannot have more than 20 items' }),
    montoNoFacturable: Joi.number().min(0).optional().allow(null),
    montoPeriodo: Joi.number().min(0).optional().allow(null),
    saldoAnterior: Joi.number().optional().allow(null),
    montoAvancePago: Joi.number().min(0).optional().allow(null),
    valorPagar: Joi.number().optional().allow(null),
    totalItbisPercepcion: Joi.number().min(0).optional().allow(null),
    totalIsrPercepcion: Joi.number().min(0).optional().allow(null)
});

module.exports = { totalesExtrasSchema  };