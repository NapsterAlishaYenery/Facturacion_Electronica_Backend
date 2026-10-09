// ============================================================
// Rutas del submódulo subscriptions
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../../shared/middlewares/role.middleware');
const {
    readLimiter,
    writeLimiter,
} = require('../../../shared/middlewares/rateLimit.middleware');
const validate = require('../../../shared/middlewares/validate.middleware');

const {
    listMyPaymentsQuerySchema,
    changePlanSchema,
    listSubscriptionsQuerySchema
} = require('./subscriptions.validation');

// Controlador
const subscriptionsController = require('./subscriptions.controller');

// ============================================================
// Health check del submódulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'subscriptions', status: 'ok', ready: true });
});

// ============================================================
// Rutas de usuario autenticado (mi suscripción)
// ============================================================

// GET /api/subscriptions/me — Ver mi suscripción actual
router.get('/me',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    subscriptionsController.getMySubscription
);

// GET /api/subscriptions/me/payments — Historial de mis pagos
router.get('/me/payments',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    validate(listMyPaymentsQuerySchema, 'query'),
    subscriptionsController.listMyPayments
);

// POST /api/subscriptions/me/change-plan — Cambiar de plan
router.post('/me/change-plan',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(changePlanSchema),
    subscriptionsController.changePlan
);

// POST /api/subscriptions/me/cancel — Cancelar suscripción
router.post('/me/cancel',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    subscriptionsController.cancelMySubscription
);

// ============================================================
// Rutas de admin (TODAS las suscripciones)
// ============================================================

// GET /api/subscriptions — Listar todas (admin)
router.get('/',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    validate(listSubscriptionsQuerySchema, 'query'),
    subscriptionsController.listSubscriptions
);

// GET /api/subscriptions/:id — Ver una específica (admin)
router.get('/:id',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    subscriptionsController.getSubscriptionById
);

module.exports = router;