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
    updateCompanyByIdSchema,
    toggleCompanyActiveSchema
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
        ready: true,
        message: 'Module fully implemented.'
    });
});

// ============================================================
// Rutas de usuario autenticado (mi empresa)
// ============================================================

router.get('/me',
    authMiddleware,
    readLimiter,
    companiesController.getMyCompany
);

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

// PATCH /api/companies/:id/activate — Activar/desactivar
// IMPORTANTE: va ANTES de /:id PATCH para evitar que "activate" sea capturado como :id
router.patch('/:id/activate',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(toggleCompanyActiveSchema),
    companiesController.toggleCompanyActive
);

// PATCH /api/companies/:id — Actualizar cualquiera
router.patch('/:id',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(updateCompanyByIdSchema),
    companiesController.updateCompanyById
);

// DELETE /api/companies/:id — Borrar
router.delete('/:id',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    companiesController.deleteCompany
);

module.exports = router;