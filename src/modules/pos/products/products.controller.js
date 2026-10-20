// ============================================================
// Controlador de productos
// ============================================================

const productsService = require('./products.service');
const catchAsync = require('../../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/products/me
// ------------------------------------------------------------
const listMyProducts = catchAsync(async (req, res) => {
    const result = await productsService.listMyProducts(
        req.user.companyId,
        req.validated.query
    );

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/products/me/:id
// ------------------------------------------------------------
const getMyProductById = catchAsync(async (req, res) => {
    const result = await productsService.getMyProductById(
        req.user.companyId,
        req.params.id
    );

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// POST /api/products/me
// ------------------------------------------------------------
const createMyProduct = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await productsService.createMyProduct(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: result
    });
});

// ------------------------------------------------------------
// PATCH /api/products/me/:id
// ------------------------------------------------------------
const updateMyProduct = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await productsService.updateMyProduct(
        req.user.companyId,
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Product updated successfully',
        data: result
    });
});

// ------------------------------------------------------------
// PATCH /api/products/me/:id/activate
// ------------------------------------------------------------
const toggleMyProductActive = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await productsService.toggleMyProductActive(
        req.user.companyId,
        req.params.id,
        req.body.isActive,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: result.product.isActive
            ? 'Product activated successfully'
            : 'Product deactivated successfully',
        data: result
    });
});

// ------------------------------------------------------------
// DELETE /api/products/me/:id
// ------------------------------------------------------------
const deleteMyProduct = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await productsService.deleteMyProduct(
        req.user.companyId,
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Product deleted successfully',
        data: result
    });
});

module.exports = {
    listMyProducts,
    getMyProductById,
    createMyProduct,
    updateMyProduct,
    toggleMyProductActive,
    deleteMyProduct
};