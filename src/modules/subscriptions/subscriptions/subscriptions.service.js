// ============================================================
// Servicio de suscripciones
// ============================================================

const { Subscription, Plan, User, Sequence } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------- helpers -------

// Días completos restantes hasta una fecha
function daysUntil(targetDate, now = new Date()) {
    const diff = new Date(targetDate).getTime() - now.getTime();
    return diff >= 0
        ? Math.floor(diff / (24 * 60 * 60 * 1000))
        : Math.ceil(diff / (24 * 60 * 60 * 1000));
}

// Calcula el vencimiento efectivo según el status
function getEffectiveExpiry(sub) {
    if (sub.status === 'trial') return sub.trialEndsAt;
    if (sub.status === 'active') return sub.currentPeriodEnd;
    if (sub.status === 'past_due') return sub.currentPeriodEnd || sub.trialEndsAt;
    return sub.endsAt || sub.currentPeriodEnd || sub.trialEndsAt;
}

// Construye el objeto de uso con soporte para -1 (unlimited)
function buildUsageBlock(used, limit) {
    if (limit === -1) {
        return { used, limit, unlimited: true, remaining: null };
    }
    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : 0;
    return { used, limit, unlimited: false, remaining, percentUsed };
}

// ------------------------------------------------------------
// Obtener mi suscripción actual (company_admin)
// ------------------------------------------------------------
async function getMySubscription(companyId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar suscripción activa (trial, active, past_due)
    let subscription = await Subscription.findOne({
        where: {
            companyId,
            status: ['trial', 'active', 'past_due']
        },
        include: [{
            model: Plan,
            as: 'plan'
        }],
        order: [['createdAt', 'DESC']]
    });

    // 2. Fallback: la última de cualquier estado (para mostrar "expirada")
    let isActive = true;
    if (!subscription) {
        subscription = await Subscription.findOne({
            where: { companyId },
            include: [{ model: Plan, as: 'plan' }],
            order: [['createdAt', 'DESC']]
        });
        isActive = false;
    }

    if (!subscription) {
        throw new AppError(
            'No subscription found for this company',
            404,
            'NO_SUBSCRIPTION_FOUND'
        );
    }

    // 3. Contar uso actual
    const usersCount = await User.count({
        where: { companyId, isActive: true }
    });
    const sequencesCount = await Sequence.count({
        where: { companyId, isActive: true }
    });

    // 4. Calcular vencimiento y días restantes
    const expiresAt = getEffectiveExpiry(subscription);
    const daysLeft = isActive && expiresAt ? daysUntil(expiresAt) : 0;

    // 5. Construir la respuesta
    const plan = subscription.plan;
    const usedInvoices = Number(subscription.invoicesUsedThisMonth) || 0;

    return {
        subscription: {
            id: subscription.id,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
            cancelledAt: subscription.cancelledAt,
            invoicesUsedThisMonth: usedInvoices,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt
        },
        plan: plan ? {
            id: plan.id,
            code: plan.code,
            name: plan.name,
            description: plan.description,
            priceDop: plan.priceDop,
            priceUsd: plan.priceUsd,
            invoicesPerMonth: plan.invoicesPerMonth,
            maxUsers: plan.maxUsers,
            maxSequences: plan.maxSequences,
            features: plan.features,
            isActive: plan.isActive
        } : null,
        usage: {
            invoices: buildUsageBlock(usedInvoices, plan?.invoicesPerMonth ?? 0),
            users: buildUsageBlock(usersCount, plan?.maxUsers ?? 0),
            sequences: buildUsageBlock(sequencesCount, plan?.maxSequences ?? 0)
        },
        isActive,
        expiresAt,
        daysLeft
    };
}

module.exports = {
    getMySubscription
};