// ============================================================
// Rutas del submódulo subscriptions
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../../shared/middlewares/role.middleware');
const { readLimiter } = require('../../../shared/middlewares/rateLimit.middleware');
const validate = require('../../../shared/middlewares/validate.middleware');

const {
    listMyPaymentsQuerySchema,
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

module.exports = router;