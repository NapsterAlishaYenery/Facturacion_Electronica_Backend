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

// ------------------------------------------------------------
// POST /api/plans (admin)
// ------------------------------------------------------------
const createPlan = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const plan = await plansService.createPlan(req.body, req.user, reqInfo);

    res.status(201).json({
        success: true,
        message: 'Plan created successfully',
        data: { plan }
    });
});

// ------------------------------------------------------------
// PATCH /api/plans/:id (admin)
// ------------------------------------------------------------
const updatePlanById = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const plan = await plansService.updatePlanById(
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Plan updated successfully',
        data: { plan }
    });
});

module.exports = {
    listPlans,
    getPlanById,
    createPlan,
    updatePlanById
};