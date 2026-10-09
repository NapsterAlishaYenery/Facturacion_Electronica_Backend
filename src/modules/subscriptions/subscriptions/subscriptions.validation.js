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

// ------------------------------------------------------------
// Schema: registrar pago (admin)
// ------------------------------------------------------------
const registerPaymentSchema = Joi.object({
    amount: Joi.number().positive().precision(2).required()
        .messages({
            'number.positive': 'Amount must be greater than 0',
            'any.required': 'Amount is required'
        }),
    currency: Joi.string().valid('DOP', 'USD').default('DOP'),
    paymentMethod: Joi.string()
        .valid('cash', 'transfer', 'card', 'stripe', 'paypal')
        .allow(null)
        .optional(),
    reference: Joi.string().max(100).allow(null, '').optional(),
    periodStart: Joi.date().iso().required()
        .messages({
            'any.required': 'periodStart is required'
        }),
    periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required()
        .messages({
            'date.greater': 'periodEnd must be after periodStart',
            'any.required': 'periodEnd is required'
        }),
    status: Joi.string()
        .valid('pending', 'paid', 'failed', 'refunded')
        .default('pending'),
    paidAt: Joi.date().iso().allow(null).optional(),
    notes: Joi.string().max(2000).allow(null, '').optional()
});

// ------------------------------------------------------------
// Schema: listar pagos de una suscripción (admin)
// ------------------------------------------------------------
const listSubscriptionPaymentsQuerySchema = Joi.object({
    status: Joi.string().valid('pending', 'paid', 'failed', 'refunded').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
    listMyPaymentsQuerySchema,
    changePlanSchema,
    listSubscriptionsQuerySchema,
    updateSubscriptionSchema,
    registerPaymentSchema,
    listSubscriptionPaymentsQuerySchema
};