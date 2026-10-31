// ============================================================
// Rutas del módulo jobs
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
const { listJobRunsQuerySchema } = require('./jobs.validation');

// Controlador
const jobsController = require('./jobs.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'jobs',
        status: 'ok',
        ready: true
    });
});

// ============================================================
// Rutas de admin global
// ============================================================

// ⚠️ IMPORTANTE: /runs va ANTES de / para que no haya ambigüedad
// (aunque / no captura subpaths, es buena práctica)
router.get('/runs',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    validate(listJobRunsQuerySchema, 'query'),
    jobsController.listRuns
);

router.get('/',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    jobsController.getOverview
);

module.exports = router;