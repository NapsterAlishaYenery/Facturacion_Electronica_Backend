// ============================================================
// Controlador de estadísticas
// Solo maneja HTTP: llama al servicio, responde.
// ============================================================

const statsService = require('./stats.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/stats/company
// ------------------------------------------------------------
const getCompanyStats = catchAsync(async (req, res) => {
    const stats = await statsService.getCompanyStats(
        req.user.companyId,
        req.validated.query || {}
    );

    res.json({
        success: true,
        message: 'OK',
        data: stats
    });
});

// ------------------------------------------------------------
// GET /api/stats/operator
// ------------------------------------------------------------
const getOperatorStats = catchAsync(async (req, res) => {
    const stats = await statsService.getOperatorStats(req.user.companyId);

    res.json({
        success: true,
        message: 'OK',
        data: stats
    });
});

// ------------------------------------------------------------
// GET /api/stats/admin
// ------------------------------------------------------------
const getAdminStats = catchAsync(async (req, res) => {
    const stats = await statsService.getAdminStats(
        req.validated.query || {}
    );

    res.json({
        success: true,
        message: 'OK',
        data: stats
    });
});

module.exports = {
    getCompanyStats,
    getOperatorStats,
    getAdminStats
};