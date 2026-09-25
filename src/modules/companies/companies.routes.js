// ============================================================
// Rutas del módulo companies
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const { writeLimiter } = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones (se usarán cuando se implementen los endpoints)
const companiesValidation = require('./companies.validation');

// Controlador
const companiesController = require('./companies.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'companies',
        status: 'ok',
        ready: false,
        message: 'Module mounted. Endpoints pending implementation.'
    });
});

// ============================================================
// Rutas de usuario autenticado (mi empresa)
// ============================================================

// GET /api/companies/me — Ver mi empresa
router.get('/me',
    authMiddleware,
    companiesController.getMyCompany
);

// ============================================================
// Endpoints planeados (implementación pendiente)
// ============================================================
// PATCH  /api/companies/me                    → actualizar mi empresa
// GET    /api/companies                       → listar todas (admin)
// GET    /api/companies/:id                   → ver una (admin)
// PATCH  /api/companies/:id                   → actualizar cualquiera (admin)
// PATCH  /api/companies/:id/activate          → activar/desactivar (admin)
// DELETE /api/companies/:id                   → borrar (admin)

module.exports = router;