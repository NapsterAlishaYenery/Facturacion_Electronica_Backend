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
        }),

    // Opcional: días de validez. Si viene, expiresAt = now + days.
    // Si no viene, no expira.
    expiresInDays: Joi.number().integer().min(1).max(3650).optional()
        .messages({
            'number.min': 'expiresInDays must be at least 1',
            'number.max': 'expiresInDays cannot exceed 3650 (10 years)'
        })
});

module.exports = { createApiKeySchema };