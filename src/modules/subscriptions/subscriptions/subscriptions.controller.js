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

// ------------------------------------------------------------
// GET /api/subscriptions/me/payments (company_admin)
// ------------------------------------------------------------
const listMyPayments = catchAsync(async (req, res) => {
    const result = await subscriptionsService.listMyPayments(
        req.user.companyId,
        req.validated.query
    );

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    getMySubscription,
    listMyPayments
};
