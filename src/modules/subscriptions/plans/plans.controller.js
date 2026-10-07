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

// ------------------------------------------------------------
// GET /api/plans/:id (público)
// ------------------------------------------------------------
const getPlanById = catchAsync(async (req, res) => {
    const plan = await plansService.getPlanById(req.params.id);

    res.json({
        success: true,
        data: { plan }
    });
});

module.exports = {
    listPlans,
    getPlanById
};