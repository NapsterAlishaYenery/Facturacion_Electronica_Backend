// ============================================================
// Rutas del módulo invoices
// Fase 3 - Step 10.0: Solo estructura base y health check
// ============================================================

const express = require('express');
const router = express.Router();

// Middlewares (se usarán cuando se implementen los endpoints)
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const {
    writeLimiter,
    readLimiter
} = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones (se usarán cuando se implementen los endpoints)
// const invoicesValidation = require('./invoices.validation');

// Controlador (se usará cuando se implementen los endpoints)
// const invoicesController = require('./invoices.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'invoices',
        status: 'ok',
        ready: false,
        message: 'Module mounted. Endpoints pending implementation.'
    });
});

// ============================================================
// Endpoints planeados (implementación pendiente)
// ============================================================
// GET    /api/invoices/me                       → listar mis facturas
// GET    /api/invoices/me/:id                   → ver una específica
// POST   /api/invoices/me                       → crear borrador
// PATCH  /api/invoices/me/:id                   → editar borrador
// DELETE /api/invoices/me/:id                   → borrar borrador
// POST   /api/invoices/me/:id/lines             → agregar línea
// PATCH  /api/invoices/me/:id/lines/:lineId     → editar línea
// DELETE /api/invoices/me/:id/lines/:lineId     → borrar línea
// GET    /api/invoices                          → listar todas (admin)
// GET    /api/invoices/:id                      → ver una (admin)

module.exports = router;