// ============================================================
// Rutas del módulo api-keys (FASE 18.1)
// ============================================================
//
// Todas requieren JWT + company_admin.
// La API Key NO sirve para gestionar API Keys (sería chicken-egg).
// ============================================================

const express = require('express');
const router = express.Router();

const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const {
    writeLimiter,
    readLimiter
} = require('../../shared/middlewares/rateLimit.middleware');

const { createApiKeySchema } = require('./api-keys.validation');
const apiKeysController = require('./api-keys.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'api-keys',
        status: 'ok',
        ready: true,
        message: 'API Keys module ready.'
    });
});

// ============================================================
// Rutas (todas con JWT + company_admin)
// ============================================================

// GET /api/api-keys — Listar mis keys
router.get('/',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    apiKeysController.listApiKeys
);

// POST /api/api-keys — Crear una key
router.post('/',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(createApiKeySchema),
    apiKeysController.createApiKey
);

// PATCH /api/api-keys/:id/revoke — Revocar una key
router.patch('/:id/revoke',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    apiKeysController.revokeApiKey
);

module.exports = router;