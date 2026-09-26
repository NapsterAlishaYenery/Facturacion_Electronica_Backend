// ============================================================
// Validaciones Joi para el módulo sequences
// Pendiente: agregar schemas cuando se implementen los endpoints
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: filtros de listado (company_admin)
// ------------------------------------------------------------
const listSequencesQuerySchema = Joi.object({
    type: Joi.string().valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47').optional(),
    prefix: Joi.string().max(5).optional(),
    isActive: Joi.boolean().optional(),
    expired: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ------------------------------------------------------------
// Schema: crear secuencia (company_admin)
// ------------------------------------------------------------
const createSequenceSchema = Joi.object({
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .required()
        .messages({
            'any.required': 'Type is required',
            'any.only': 'Type must be a valid e-CF type (31, 32, 33, 34, 41, 43, 44, 45, 46, 47)'
        }),
    prefix: Joi.string().uppercase().valid('E').default('E'),
    startNumber: Joi.string()
        .pattern(/^\d{10}$/)
        .required()
        .messages({
            'string.pattern.base': 'Start number must be exactly 10 digits (e.g. 0000000001)',
            'any.required': 'Start number is required'
        }),
    endNumber: Joi.string()
        .pattern(/^\d{10}$/)
        .required()
        .messages({
            'string.pattern.base': 'End number must be exactly 10 digits (e.g. 0000000100)',
            'any.required': 'End number is required'
        }),
    expiresAt: Joi.date().iso().greater('now').required()
        .messages({
            'any.required': 'Expiration date is required',
            'date.greater': 'Expiration date must be in the future'
        })
}).custom((value, helpers) => {
    const start = parseInt(value.startNumber, 10);
    const end = parseInt(value.endNumber, 10);
    if (end <= start) {
        return helpers.error('any.custom', {
            message: 'endNumber must be greater than startNumber'
        });
    }
    return value;
}).messages({
    'any.custom': '{{#message}}'
});

module.exports = {
    listSequencesQuerySchema,
    createSequenceSchema
};

// Schemas planeados:
// - createSequenceSchema
// - updateSequenceSchema
// - toggleSequenceActiveSchema
// - listSequencesQuerySchema
