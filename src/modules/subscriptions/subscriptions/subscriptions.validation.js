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

// ------------------------------------------------------------
// Schema: listar todas las suscripciones (admin)
// ------------------------------------------------------------
const listSubscriptionsQuerySchema = Joi.object({
    status: Joi.string()
        .valid('trial', 'active', 'past_due', 'cancelled', 'expired')
        .optional(),
    planId: Joi.string().uuid().optional(),
    companyId: Joi.string().uuid().optional(),
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ------------------------------------------------------------
// Schema: actualizar suscripción (admin)
// ------------------------------------------------------------
const updateSubscriptionSchema = Joi.object({
    status: Joi.string()
        .valid('trial', 'active', 'past_due', 'cancelled', 'expired')
        .optional(),
    trialEndsAt: Joi.date().iso().allow(null).optional(),
    currentPeriodStart: Joi.date().iso().optional(),
    currentPeriodEnd: Joi.date().iso().allow(null).optional(),
    endsAt: Joi.date().iso().allow(null).optional(),
    cancelledAt: Joi.date().iso().allow(null).optional(),
    invoicesUsedThisMonth: Joi.number().integer().min(0).optional()
        .messages({
            'number.min': 'Invoices used cannot be negative'
        })
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});

module.exports = {
    listMyPaymentsQuerySchema,
    changePlanSchema,
    listSubscriptionsQuerySchema,
    updateSubscriptionSchema
};