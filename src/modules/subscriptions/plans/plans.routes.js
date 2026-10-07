// ============================================================
// Rutas del submódulo planes
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const validate = require('../../../shared/middlewares/validate.middleware');
const { readLimiter } = require('../../../shared/middlewares/rateLimit.middleware');

// Validaciones
const { listPlansQuerySchema } = require('./plans.validation');

// Controlador
const plansController = require('./plans.controller');

// ============================================================
// Health check del submódulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'plans', status: 'ok', ready: true });
});

// ============================================================
// Rutas públicas
// ============================================================

// GET /api/plans — Listar planes activos (público)
router.get('/',
    readLimiter,
    validate(listPlansQuerySchema, 'query'),
    plansController.listPlans
);

// GET /api/plans/:id — Detalle de un plan (público)
router.get('/:id',
    readLimiter,
    plansController.getPlanById
);

module.exports = router;