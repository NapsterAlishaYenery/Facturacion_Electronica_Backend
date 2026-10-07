// ============================================================
// Controlador de suscripciones
// ============================================================

const subscriptionsService = require('./subscriptions.service');
const catchAsync = require('../../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/subscriptions/me (company_admin)
// ------------------------------------------------------------
const getMySubscription = catchAsync(async (req, res) => {
    const result = await subscriptionsService.getMySubscription(req.user.companyId);

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    getMySubscription
};
