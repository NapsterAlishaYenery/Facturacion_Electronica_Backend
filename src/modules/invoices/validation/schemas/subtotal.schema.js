const Joi = require('joi');

// El cliente SOLO manda el agrupamiento:
//   - numeroSubtotal: secuencial 1-20
//   - descripcion:    texto libre (ej: "Bebidas")
//   - orden:          opcional, para ordenar
//
// El agrupamiento real se hace por `items[].subtotalId`:
// cada línea con subtotalId=N pertenece al subtotal N.
//
// Los montos (montoGravadoTotal, subTotalItbis, montoSubTotal, etc.)
// los calcula el SERVICE sumando las líneas del grupo. NUNCA se
// aceptan del cliente. `.unknown(false)` rechaza cualquier monto
// que el cliente intente mandar.
// ============================================================
const subtotalSchema = Joi.object({
    numeroSubtotal: Joi.number().integer().min(1).max(20).required()
        .messages({
            'any.required': 'numeroSubtotal is required',
            'number.min': 'numeroSubtotal must be between 1 and 20',
            'number.max': 'numeroSubtotal must be between 1 and 20'
        }),
    descripcion: Joi.string().max(40).optional().allow(null, '')
        .messages({ 'string.max': 'DescripcionSubtotal cannot exceed 40 characters' }),
    orden: Joi.number().integer().min(1).optional().allow(null)
}).unknown(false)
    .messages({
        'object.unknown': 'subtotales[] solo acepta numeroSubtotal, descripcion y orden. Los montos los calcula el sistema a partir de items[].subtotalId.'
    });


module.exports = { subtotalSchema };