// ============================================================
// Controlador de facturas
// Pendiente: agregar controladores cuando se implementen los endpoints
// ============================================================

const invoicesService = require('./invoices.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/invoices/me
// ------------------------------------------------------------
const listMyInvoices = catchAsync(async (req, res) => {
    const result = await invoicesService.listMyInvoices(
        req.user.companyId,
        req.validated.query
    );

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/invoices/me/:id
// ------------------------------------------------------------
const getMyInvoiceById = catchAsync(async (req, res) => {
    const result = await invoicesService.getMyInvoiceById(
        req.user.companyId,
        req.params.id
    );

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// POST /api/invoices/me
// ------------------------------------------------------------
const createMyInvoice = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await invoicesService.createMyInvoice(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: result
    });
});

// ------------------------------------------------------------
// PATCH /api/invoices/me/:id
// ------------------------------------------------------------
const updateMyInvoice = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await invoicesService.updateMyInvoice(
        req.user.companyId,
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: result
    });
});

// ------------------------------------------------------------
// DELETE /api/invoices/me/:id
// ------------------------------------------------------------
const deleteMyInvoice = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await invoicesService.deleteMyInvoice(
        req.user.companyId,
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Invoice deleted successfully',
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/invoices (admin)
// ------------------------------------------------------------
const listAllInvoices = catchAsync(async (req, res) => {
    const result = await invoicesService.listAllInvoices(req.validated.query);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/invoices/:id (admin)
// ------------------------------------------------------------
const getInvoiceById = catchAsync(async (req, res) => {
    const result = await invoicesService.getInvoiceById(req.params.id);

    res.json({
        success: true,
        data: result
    });
});


module.exports = {
    listMyInvoices,
    getMyInvoiceById,
    createMyInvoice,
    updateMyInvoice,
    deleteMyInvoice,
    listAllInvoices,
    getInvoiceById
};

// Controladores planeados:
// - listMyInvoices
// - getMyInvoiceById
// - createMyInvoice
// - updateMyInvoice
// - deleteMyInvoice
// - addLineToMyInvoice
// - updateLineOfMyInvoice
// - deleteLineOfMyInvoice
// - listAllInvoices
// - getInvoiceById
