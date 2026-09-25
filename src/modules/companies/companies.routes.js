// ============================================================
// Rutas del módulo companies
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
    updateMyCompanySchema,
    listCompaniesQuerySchema,
    updateCompanyByIdSchema
} = require('./companies.validation');

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
    readLimiter,
    companiesController.getMyCompany
);

// PATCH /api/companies/me — Actualizar mi empresa
router.patch('/me',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(updateMyCompanySchema),
    companiesController.updateMyCompany
);

// ============================================================
// Rutas de admin (TODAS las empresas)
// ============================================================

// GET /api/companies — Listar todas
router.get('/',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    validate(listCompaniesQuerySchema, 'query'),
    companiesController.listCompanies
);

// GET /api/companies/:id — Ver una específica
router.get('/:id',
    authMiddleware,
    roleMiddleware('admin'),
    readLimiter,
    companiesController.getCompanyById
);

// PATCH /api/companies/:id — Actualizar cualquiera
router.patch('/:id',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(updateCompanyByIdSchema),
    companiesController.updateCompanyById
);

// ============================================================
// Endpoints planeados (implementación pendiente)
// ============================================================
// PATCH  /api/companies/:id/activate          → activar/desactivar (admin)
// DELETE /api/companies/:id                   → borrar (admin)

module.exports = router;