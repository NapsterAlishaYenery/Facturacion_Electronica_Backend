// ============================================================
// Helpers de suscripción reutilizables
// Verifican que una empresa puede usar un recurso según su
// suscripción activa y los límites del plan.
//
// Todos los helpers aceptan { transaction } para poder usarse
// dentro de transacciones de Sequelize.
// ============================================================

const { Op } = require('sequelize');
const {
    Subscription,
    Plan,
    User,
    Sequence
} = require('../../models');
const { AppError } = require('../middlewares/error.middleware');

// ------------------------------------------------------------
// Obtener la suscripción activa de una empresa
// (trial, active o past_due)
// ------------------------------------------------------------
async function getActiveSubscription(companyId, options = {}) {
    return Subscription.findOne({
        where: {
            companyId,
            status: ['trial', 'active', 'past_due']
        },
        include: [{ model: Plan, as: 'plan' }],
        order: [['createdAt', 'DESC']],
        transaction: options.transaction
    });
}

// ------------------------------------------------------------
// Contar recursos activos de una empresa
// ------------------------------------------------------------
async function countActiveUsers(companyId, options = {}) {
    return User.count({
        where: { companyId, isActive: true },
        transaction: options.transaction
    });
}

async function countActiveSequences(companyId, options = {}) {
    return Sequence.count({
        where: { companyId, isActive: true },
        transaction: options.transaction
    });
}

// ------------------------------------------------------------
// Límite efectivo según el plan para un recurso
// Devuelve -1 si es ilimitado
// ------------------------------------------------------------
function getPlanLimit(plan, resource) {
    if (!plan) return 0;

    switch (resource) {
        case 'invoices':  return plan.invoicesPerMonth;
        case 'users':     return plan.maxUsers;
        case 'sequences': return plan.maxSequences;
        default:
            throw new AppError(
                `Unknown subscription resource: ${resource}`,
                500,
                'INVALID_SUBSCRIPTION_RESOURCE'
            );
    }
}

// ------------------------------------------------------------
// Verifica que la empresa tenga una suscripción activa.
// Devuelve la suscripción (con plan) si todo OK.
// Lanza AppError si no hay suscripción.
// ------------------------------------------------------------
async function assertSubscriptionActive(companyId, options = {}) {
    const subscription = await getActiveSubscription(companyId, options);

    if (!subscription) {
        throw new AppError(
            'No active subscription found. Please contact support.',
            403,
            'NO_ACTIVE_SUBSCRIPTION'
        );
    }

    return subscription;
}

// ------------------------------------------------------------
// Verifica que la empresa pueda usar un recurso según su plan.
//
// Uso:
//   const subscription = await assertSubscriptionCanUse(
//       companyId, 'invoices', { transaction: t }
//   );
//   // ... crear el recurso ...
//   await subscription.increment('invoicesUsedThisMonth', { transaction: t });
//
// Devuelve la suscripción (con plan) para que el caller pueda
// incrementar contadores o consultar datos extra.
//
// Lanza:
//   - NO_ACTIVE_SUBSCRIPTION (403) si no hay suscripción activa
//   - RESOURCE_LIMIT_REACHED (403) si se superó el límite del plan
// ------------------------------------------------------------
async function assertSubscriptionCanUse(companyId, resource, options = {}) {
    // 1. Suscripción activa
    const subscription = await assertSubscriptionActive(companyId, options);
    const plan = subscription.plan;

    // 2. Límite del plan
    const limit = getPlanLimit(plan, resource);
    if (limit === -1) {
        // Ilimitado
        return subscription;
    }

    // 3. Uso actual
    let used = 0;
    switch (resource) {
        case 'invoices':
            used = Number(subscription.invoicesUsedThisMonth) || 0;
            break;
        case 'users':
            used = await countActiveUsers(companyId, options);
            break;
        case 'sequences':
            used = await countActiveSequences(companyId, options);
            break;
    }

    // 4. Comparar
    if (used >= limit) {
        throw new AppError(
            `Plan limit reached for ${resource} (${used}/${limit}). Upgrade your plan to continue.`,
            403,
            'RESOURCE_LIMIT_REACHED',
            { resource, used, limit }
        );
    }

    return subscription;
}

module.exports = {
    getActiveSubscription,
    countActiveUsers,
    countActiveSequences,
    getPlanLimit,
    assertSubscriptionActive,
    assertSubscriptionCanUse
};