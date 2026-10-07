// ============================================================
// Rutas del submódulo planes
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../../shared/middlewares/role.middleware');
const validate = require('../../../shared/middlewares/validate.middleware');
const { readLimiter, writeLimiter } = require('../../../shared/middlewares/rateLimit.middleware');

// Validaciones
const { listPlansQuerySchema, createPlanSchema } = require('./plans.validation');

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

// ============================================================
// Rutas Privadas
// ============================================================

// POST /api/plans — Crear plan (solo admin)
router.post('/',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(createPlanSchema),
    plansController.createPlan
);

module.exports = router;