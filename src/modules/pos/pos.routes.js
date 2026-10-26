// ============================================================
// Rutas del módulo POS (facturación rápida)
// ============================================================
//
// Solo company_admin puede emitir facturas (consistente con
// el endpoint /api/invoices/me).
// ============================================================

const express = require('express');
const router = express.Router();

const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const { writeLimiter } = require('../../shared/middlewares/rateLimit.middleware');

const { quickInvoiceSchema } = require('./pos.validation');
const posController = require('./pos.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'pos',
        status: 'ok',
        ready: true,
        message: 'POS module ready (quick invoicing).'
    });
});

// ============================================================
// POST /api/pos/quick — Factura rápida (tipos 31 y 32)
// ============================================================
router.post('/quick',
    authMiddleware,
    roleMiddleware('operator'),
    writeLimiter,
    validate(quickInvoiceSchema),
    posController.quickInvoice
);

module.exports = router;