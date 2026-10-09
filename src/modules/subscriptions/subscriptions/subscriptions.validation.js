// ============================================================
// Validaciones Joi para suscripciones
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: listar mis pagos (company_admin)
// ------------------------------------------------------------
const listMyPaymentsQuerySchema = Joi.object({
    status: Joi.string().valid('pending', 'paid', 'failed', 'refunded').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ------------------------------------------------------------
// Schema: cambiar de plan (company_admin)
// ------------------------------------------------------------
const changePlanSchema = Joi.object({
    planId: Joi.string().uuid().required()
        .messages({
            'string.guid': 'planId must be a valid UUID',
            'any.required': 'planId is required'
        })
});

module.exports = {
    listMyPaymentsQuerySchema,
    changePlanSchema
};