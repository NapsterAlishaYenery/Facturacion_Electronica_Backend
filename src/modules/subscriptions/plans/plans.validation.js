// ============================================================
// Validaciones Joi para planes
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: listar planes (público)
// ------------------------------------------------------------
const listPlansQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ------------------------------------------------------------
// Schema: crear plan (admin)
// ------------------------------------------------------------
const createPlanSchema = Joi.object({
    code: Joi.string().min(2).max(50).lowercase().trim().required()
        .messages({
            'string.min': 'Plan code must be at least 2 characters',
            'string.max': 'Plan code cannot exceed 50 characters',
            'any.required': 'Plan code is required'
        }),
    name: Joi.string().min(2).max(100).trim().required()
        .messages({
            'string.min': 'Plan name must be at least 2 characters',
            'string.max': 'Plan name cannot exceed 100 characters',
            'any.required': 'Plan name is required'
        }),
    description: Joi.string().max(2000).allow(null, '').optional(),
    priceDop: Joi.number().min(0).precision(2).required()
        .messages({
            'number.min': 'Price in DOP cannot be negative',
            'any.required': 'Price in DOP is required'
        }),
    priceUsd: Joi.number().min(0).precision(2).allow(null).optional(),
    invoicesPerMonth: Joi.number().integer().min(-1).required()
        .messages({
            'number.min': 'Invoices per month must be -1 (unlimited) or greater',
            'any.required': 'Invoices per month is required'
        }),
    maxUsers: Joi.number().integer().min(-1).required()
        .messages({
            'number.min': 'Max users must be -1 (unlimited) or greater',
            'any.required': 'Max users is required'
        }),
    maxSequences: Joi.number().integer().min(-1).required()
        .messages({
            'number.min': 'Max sequences must be -1 (unlimited) or greater',
            'any.required': 'Max sequences is required'
        }),
    features: Joi.object().allow(null).optional()
});

// ------------------------------------------------------------
// Schema: actualizar plan (admin)
// ------------------------------------------------------------
const updatePlanSchema = Joi.object({
    code: Joi.string().min(2).max(50).lowercase().trim().optional()
        .messages({
            'string.min': 'Plan code must be at least 2 characters',
            'string.max': 'Plan code cannot exceed 50 characters'
        }),
    name: Joi.string().min(2).max(100).trim().optional()
        .messages({
            'string.min': 'Plan name must be at least 2 characters',
            'string.max': 'Plan name cannot exceed 100 characters'
        }),
    description: Joi.string().max(2000).allow(null, '').optional(),
    priceDop: Joi.number().min(0).precision(2).optional()
        .messages({
            'number.min': 'Price in DOP cannot be negative'
        }),
    priceUsd: Joi.number().min(0).precision(2).allow(null).optional(),
    invoicesPerMonth: Joi.number().integer().min(-1).optional()
        .messages({
            'number.min': 'Invoices per month must be -1 (unlimited) or greater'
        }),
    maxUsers: Joi.number().integer().min(-1).optional()
        .messages({
            'number.min': 'Max users must be -1 (unlimited) or greater'
        }),
    maxSequences: Joi.number().integer().min(-1).optional()
        .messages({
            'number.min': 'Max sequences must be -1 (unlimited) or greater'
        }),
    features: Joi.object().allow(null).optional()
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});

module.exports = {
    listPlansQuerySchema,
    createPlanSchema,
    updatePlanSchema
};
