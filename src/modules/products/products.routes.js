// ============================================================
// Rutas del módulo products (catálogo POS)
// ============================================================
//
// Todas las rutas son de "mi empresa" (companyId del JWT).
// No hay endpoints de admin porque el catálogo es por empresa
// y el admin del sistema no necesita verlo.
// ============================================================

const express = require('express');
const router = express.Router();

const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const {
    writeLimiter,
    readLimiter
} = require('../../shared/middlewares/rateLimit.middleware');

const {
    createProductSchema,
    updateProductSchema,
    listProductsQuerySchema,
    toggleProductActiveSchema
} = require('./products.validation');

const productsController = require('./products.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'products',
        status: 'ok',
        ready: true,
        message: 'Products module ready (POS internal catalog).'
    });
});

// ============================================================
// Lectura (company_admin + operator)
// ============================================================

// GET /api/products/me — Listar mis productos
router.get('/me',
    authMiddleware,
    roleMiddleware('operator'),
    readLimiter,
    validate(listProductsQuerySchema, 'query'),
    productsController.listMyProducts
);

// GET /api/products/me/:id — Ver uno
router.get('/me/:id',
    authMiddleware,
    roleMiddleware('operator'),
    readLimiter,
    productsController.getMyProductById
);

// ============================================================
// Escritura (solo company_admin)
// ============================================================

// POST /api/products/me — Crear
router.post('/me',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(createProductSchema),
    productsController.createMyProduct
);

// PATCH /api/products/me/:id — Actualizar
router.patch('/me/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(updateProductSchema),
    productsController.updateMyProduct
);

// PATCH /api/products/me/:id/activate — Activar/desactivar
router.patch('/me/:id/activate',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(toggleProductActiveSchema),
    productsController.toggleMyProductActive
);

// DELETE /api/products/me/:id — Borrar
router.delete('/me/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    productsController.deleteMyProduct
);

module.exports = router;