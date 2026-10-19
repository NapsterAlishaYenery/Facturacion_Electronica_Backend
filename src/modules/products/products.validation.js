// ============================================================
// Validaciones Joi para el módulo products
// ============================================================
//
// Notas de diseño:
//  - El POS solo emite tipos 31 y 32.
//  - Por eso taxType NUNCA acepta ITBIS_3_46 en este módulo
//    (ITBIS_3_46 solo aplica a e-CF tipo 46, fuera del POS).
//  - itemCode es único por empresa, pero eso se valida en el
//    servicio (no en Joi) para devolver un 409 semántico.
// ============================================================

const Joi = require('joi');

// Tasa de ITBIS permitida en el POS (sin ITBIS_3_46)
const POS_TAX_TYPES = ['ITBIS_18', 'ITBIS_16', 'EXENTO'];

// ============================================================
// Schema: crear producto
// ============================================================
const createProductSchema = Joi.object({
    name: Joi.string().min(2).max(200).required()
        .messages({
            'any.required': 'Product name is required',
            'string.min': 'Product name must be at least 2 characters',
            'string.max': 'Product name cannot exceed 200 characters'
        }),

    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({
            'string.max': 'Product description cannot exceed 1000 characters'
        }),

    price: Joi.number().min(0).max(9999999999.99).required()
        .messages({
            'any.required': 'Product price is required',
            'number.min': 'Product price cannot be negative',
            'number.max': 'Product price is too large'
        }),

    taxType: Joi.string().valid(...POS_TAX_TYPES).required()
        .messages({
            'any.required': 'taxType is required',
            'any.only': 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO'
        }),

    itemCode: Joi.string().max(50).optional().allow(null, '')
        .messages({
            'string.max': 'itemCode cannot exceed 50 characters'
        }),

    isActive: Joi.boolean().default(true)
});

// ============================================================
// Schema: actualizar producto (parcial)
// ============================================================
const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(200).optional()
        .messages({
            'string.min': 'Product name must be at least 2 characters',
            'string.max': 'Product name cannot exceed 200 characters'
        }),

    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({
            'string.max': 'Product description cannot exceed 1000 characters'
        }),

    price: Joi.number().min(0).max(9999999999.99).optional()
        .messages({
            'number.min': 'Product price cannot be negative',
            'number.max': 'Product price is too large'
        }),

    taxType: Joi.string().valid(...POS_TAX_TYPES).optional()
        .messages({
            'any.only': 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO'
        }),

    itemCode: Joi.string().max(50).optional().allow(null, '')
        .messages({
            'string.max': 'itemCode cannot exceed 50 characters'
        }),

    isActive: Joi.boolean().optional()
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required to update'
    });

// ============================================================
// Schema: listar (query)
// ============================================================
const listProductsQuerySchema = Joi.object({
    isActive: Joi.boolean().truthy('true').falsy('false').optional(),
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ============================================================
// Schema: activar/desactivar
// ============================================================
const toggleProductActiveSchema = Joi.object({
    isActive: Joi.boolean().required()
        .messages({
            'any.required': 'isActive is required',
            'boolean.base': 'isActive must be a boolean'
        })
});

module.exports = {
    createProductSchema,
    updateProductSchema,
    listProductsQuerySchema,
    toggleProductActiveSchema,
    POS_TAX_TYPES
};