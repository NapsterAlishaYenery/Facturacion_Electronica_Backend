// ============================================================
// Rutas del módulo companies
// Fase 3 - Step 8.0: Solo estructura base y health check
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares (se usarán cuando se implementen los endpoints)
// const authMiddleware = require('../../shared/middlewares/auth.middleware');
// const roleMiddleware = require('../../shared/middlewares/role.middleware');
// const validate = require('../../shared/middlewares/validate.middleware');
// const { writeLimiter } = require('../../shared/middlewares/rateLimit.middleware');

// // Validaciones (se usarán cuando se implementen los endpoints)
// const companiesValidation = require('./companies.validation');

// // Controlador (se usará cuando se implementen los endpoints)
// const companiesController = require('./companies.controller');

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
// Endpoints planeados (implementación pendiente)
// ============================================================
// GET    /api/companies/me                    → mi empresa
// PATCH  /api/companies/me                    → actualizar mi empresa
// GET    /api/companies                       → listar todas (admin)
// GET    /api/companies/:id                   → ver una (admin)
// PATCH  /api/companies/:id                   → actualizar cualquiera (admin)
// PATCH  /api/companies/:id/activate          → activar/desactivar (admin)
// DELETE /api/companies/:id                   → borrar (admin)

module.exports = router;