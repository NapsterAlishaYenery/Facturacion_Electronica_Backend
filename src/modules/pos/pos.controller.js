// ============================================================
// Controlador del POS (facturación rápida)
// ============================================================

const posService = require('./pos.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// POST /api/pos/quick
// ------------------------------------------------------------
const quickInvoice = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await posService.createQuickInvoice(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    res.status(201).json({
        success: true,
        message: 'Quick invoice created successfully',
        data: result
    });
});

module.exports = {
    quickInvoice
};