// ============================================================
// Validaciones Joi para el módulo companies
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: actualizar mi empresa
// ------------------------------------------------------------
const updateMyCompanySchema = Joi.object({
    name: Joi.string().min(2).max(200).optional()
        .messages({
            'string.min': 'Company name must be at least 2 characters',
            'string.max': 'Company name cannot exceed 200 characters'
        }),
    tradeName: Joi.string().max(200).optional().allow(null, ''),
    email: Joi.string().email().max(150).optional().allow(null, '')
        .messages({
            'string.email': 'Email must be valid'
        }),
    phone: Joi.string().max(30).optional().allow(null, ''),
    address: Joi.string().max(300).optional().allow(null, ''),
    economicActivity: Joi.string().max(200).optional().allow(null, '')
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});


module.exports = {
    updateMyCompanySchema
};