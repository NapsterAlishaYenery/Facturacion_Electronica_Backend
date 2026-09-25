// ============================================================
// Rutas del módulo sequences
// Fase 3 - Step 9.0: Solo estructura base y health check
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const {
    writeLimiter,
    readLimiter
} = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones (se usarán cuando se implementen los endpoints)
// const sequencesValidation = require('./sequences.validation');

// Controlador (se usará cuando se implementen los endpoints)
// const sequencesController = require('./sequences.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'sequences',
        status: 'ok',
        ready: false,
        message: 'Module mounted. Endpoints pending implementation.'
    });
});

// ============================================================
// Endpoints planeados (implementación pendiente)
// ============================================================
// GET    /api/sequences/me                    → listar mis secuencias
// GET    /api/sequences/me/:id                → ver una específica
// POST   /api/sequences/me                    → crear secuencia
// PATCH  /api/sequences/me/:id                → actualizar
// PATCH  /api/sequences/me/:id/activate       → activar/desactivar
// DELETE /api/sequences/me/:id                → borrar
// GET    /api/sequences                       → listar todas (admin)

module.exports = router;