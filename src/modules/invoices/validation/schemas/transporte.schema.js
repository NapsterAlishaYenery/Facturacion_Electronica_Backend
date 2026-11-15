const Joi = require('joi');

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

module.exports = { transporteSchema };