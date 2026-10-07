// ============================================================
// Controlador de planes
// ============================================================

const plansService = require('./plans.service');
const catchAsync = require('../../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/plans (público)
// ------------------------------------------------------------
const listPlans = catchAsync(async (req, res) => {
    const result = await plansService.listPlans(req.validated.query);

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    listPlans
};