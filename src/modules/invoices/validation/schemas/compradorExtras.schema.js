const Joi = require('joi');

// Comprador — campos extendidos
const compradorExtrasSchema = Joi.object({
    contactoComprador: Joi.string().max(80).optional().allow(null, ''),
    correoComprador: Joi.string().email().max(80).optional().allow(null, '')
        .messages({ 'string.email': 'correoComprador must be a valid email' }),
    direccionComprador: Joi.string().max(100).optional().allow(null, ''),
    municipioComprador: Joi.string().pattern(/^\d{6}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'municipioComprador must be 6 digits (Tabla III)' }),
    provinciaComprador: Joi.string().pattern(/^\d{6}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'provinciaComprador must be 6 digits (Tabla III)' }),
    fechaEntrega: Joi.date().iso().optional().allow(null),
    contactoEntrega: Joi.string().max(100).optional().allow(null, ''),
    direccionEntrega: Joi.string().max(100).optional().allow(null, ''),
    telefonoAdicional: Joi.string().pattern(/^\d{3}-\d{3}-\d{4}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'telefonoAdicional must have format xxx-xxx-xxxx' }),
    fechaOrdenCompra: Joi.date().iso().optional().allow(null),
    numeroOrdenCompra: Joi.string().max(20).optional().allow(null, ''),
    codigoInternoComprador: Joi.string().max(20).optional().allow(null, ''),
    responsablePago: Joi.string().max(20).optional().allow(null, ''),
    informacionAdicionalComprador: Joi.string().max(150).optional().allow(null, '')
});

module.exports = { compradorExtrasSchema };