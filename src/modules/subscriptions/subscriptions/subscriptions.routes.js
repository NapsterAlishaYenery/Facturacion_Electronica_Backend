// ============================================================
// Rutas del submódulo subscriptions
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../../shared/middlewares/role.middleware');
const { readLimiter } = require('../../../shared/middlewares/rateLimit.middleware');

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

module.exports = router;