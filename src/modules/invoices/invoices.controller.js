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

module.exports = {
    listMyInvoices
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
