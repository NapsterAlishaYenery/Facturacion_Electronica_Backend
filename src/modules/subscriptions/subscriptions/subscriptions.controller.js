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

// ------------------------------------------------------------
// POST /api/subscriptions/me/change-plan (company_admin)
// ------------------------------------------------------------
const changePlan = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await subscriptionsService.changePlan(
        req.user.companyId,
        req.body.planId,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Plan changed successfully. A payment is now pending.',
        data: result
    });
});

// ------------------------------------------------------------
// POST /api/subscriptions/me/cancel (company_admin)
// ------------------------------------------------------------
const cancelMySubscription = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await subscriptionsService.cancelMySubscription(
        req.user.companyId,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Subscription cancelled. You keep access until the end of the current period.',
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/subscriptions (admin)
// ------------------------------------------------------------
const listSubscriptions = catchAsync(async (req, res) => {
    const result = await subscriptionsService.listSubscriptions(req.validated.query);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/subscriptions/:id (admin)
// ------------------------------------------------------------
const getSubscriptionById = catchAsync(async (req, res) => {
    const result = await subscriptionsService.getSubscriptionById(req.params.id);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// PATCH /api/subscriptions/:id (admin)
// ------------------------------------------------------------
const updateSubscriptionById = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const subscription = await subscriptionsService.updateSubscriptionById(
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Subscription updated successfully',
        data: { subscription }
    });
});

// ------------------------------------------------------------
// POST /api/subscriptions/:id/payments (admin)
// ------------------------------------------------------------
const registerPayment = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await subscriptionsService.registerPayment(
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.status(201).json({
        success: true,
        message: result.payment.status === 'paid'
            ? 'Payment registered and subscription reactivated'
            : 'Payment registered',
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/subscriptions/:id/payments (admin)
// ------------------------------------------------------------
const listSubscriptionPayments = catchAsync(async (req, res) => {
    const result = await subscriptionsService.listSubscriptionPayments(
        req.params.id,
        req.validated.query
    );

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    getMySubscription,
    listMyPayments,
    changePlan,
    cancelMySubscription,
    listSubscriptions,
    getSubscriptionById,
    updateSubscriptionById,
    registerPayment,
    listSubscriptionPayments
};
