// ============================================================
// Rutas del módulo stats
// 3 endpoints, uno por rol, más un ping de healthcheck.
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const { readLimiter } = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones
const {
    companyStatsQuerySchema,
    adminStatsQuerySchema
} = require('./stats.validation');

// Controlador
const statsController = require('./stats.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'stats',
        status: 'ok',
        ready: true,
        message: 'Stats module is alive.'
    });
});

// ============================================================
// GET /api/stats/company
// Requiere rol: company_admin (o superior)
// ============================================================
router.get('/company',
    authMiddleware,
    roleMiddleware('company_admin'),
    readLimiter,
    validate(companyStatsQuerySchema, 'query'),
    statsController.getCompanyStats
);

// (operator y admin: luego)

module.exports = router;