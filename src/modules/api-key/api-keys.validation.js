// ============================================================
// Validaciones Joi para el módulo api-keys (FASE 18.1)
// ============================================================
//
// Solo hay un schema: crear key.
// No hay update: una API Key no se modifica.
// No hay revoke schema: el id de la URL basta.
// ============================================================

const Joi = require('joi');

const createApiKeySchema = Joi.object({
    name: Joi.string().min(2).max(100).required()
        .messages({
            'string.min': 'Name must be at least 2 characters',
            'string.max': 'Name cannot exceed 100 characters',
            'any.required': 'Name is required'
        })
});

// ------------------------------------------------------------
// Schema: listar TODAS las keys (admin)
// ------------------------------------------------------------
const listAllApiKeysQuerySchema = Joi.object({
    companyId: Joi.string().uuid().optional(),
    isActive: Joi.boolean()
        .truthy('true').falsy('false')
        .optional(),
    environment: Joi.string().valid('testecf', 'production').optional(),
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});


module.exports = { createApiKeySchema, listAllApiKeysQuerySchema  };