const Joi = require('joi');

// Emisor — campos que viven en Invoice (no en Company)
const emisorExtrasSchema = Joi.object({
    codigoVendedor: Joi.string().max(60).optional().allow(null, ''),
    numeroFacturaInterna: Joi.string().max(20).optional().allow(null, ''),
    numeroPedidoInterno: Joi.string().max(20).optional().allow(null, ''),
    zonaVenta: Joi.string().max(20).optional().allow(null, ''),
    rutaVenta: Joi.string().max(20).optional().allow(null, ''),
    informacionAdicionalEmisor: Joi.string().max(250).optional().allow(null, '')
});

module.exports = { emisorExtrasSchema };