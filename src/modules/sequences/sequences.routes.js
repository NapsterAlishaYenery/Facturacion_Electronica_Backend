// ============================================================
// Rutas del módulo sequences
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

// Validaciones
const {
    listSequencesQuerySchema,
    createSequenceSchema,
    updateSequenceSchema
} = require('./sequences.validation');

// Controlador
const sequencesController = require('./sequences.controller');

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
// Rutas de company_admin (MI EMPRESA)
// ============================================================

// GET /api/sequences/me — Listar mis secuencias
router.get('/me',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    validate(listSequencesQuerySchema, 'query'),
    sequencesController.listMySequences
);

// GET /api/sequences/me/:id — Ver una específica
router.get('/me/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    sequencesController.getMySequenceById
);

// POST /api/sequences/me — Crear secuencia
router.post('/me',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(createSequenceSchema),
    sequencesController.createMySequence
);

// PATCH /api/sequences/me/:id — Actualizar
router.patch('/me/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(updateSequenceSchema),
    sequencesController.updateMySequence
);

// ============================================================
// Endpoints planeados (implementación pendiente)
// ============================================================
// PATCH  /api/sequences/me/:id/activate       → activar/desactivar
// DELETE /api/sequences/me/:id                → borrar
// GET    /api/sequences                       → listar todas (admin)


module.exports = router;