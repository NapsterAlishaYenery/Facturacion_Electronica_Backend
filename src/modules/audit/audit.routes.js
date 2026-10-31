// ============================================================
// Rutas del módulo audit
// Solo admin global. Solo lectura.
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const { readLimiter } = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones
const { listAuditQuerySchema } = require('./audit.validation');

// Controlador
const auditController = require('./audit.controller');

// ============================================================
// Todas las rutas requieren admin global
// ============================================================

// ⚠️ IMPORTANTE: /actions va ANTES de cualquier /:id
// (aunque no tenemos /:id todavía, lo dejamos preparado)
router.get('/actions',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    auditController.listActions
);

router.get('/',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    validate(listAuditQuerySchema, 'query'),
    auditController.listAuditLogs
);

// ============================================================
// Health check
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'audit', status: 'ok' });
});

module.exports = router;