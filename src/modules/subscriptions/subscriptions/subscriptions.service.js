// ============================================================
// Servicio de suscripciones
// ============================================================

const {
    Subscription,
    SubscriptionPayment,
    Plan,
    User,
    Sequence
} = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');
const sequelize = require('../../../config/database');

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

// ------------------------------------------------------------
// Listar mis pagos (company_admin)
// ------------------------------------------------------------
async function listMyPayments(companyId, filters = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const where = { companyId };
    if (filters.status) {
        where.status = filters.status;
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await SubscriptionPayment.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items: rows,
        pagination: {
            page,
            limit,
            totalItems: count,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

// ------------------------------------------------------------
// Cambiar de plan (company_admin)
// ------------------------------------------------------------
async function changePlan(companyId, newPlanId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Suscripción activa
    const subscription = await Subscription.findOne({
        where: {
            companyId,
            status: ['trial', 'active', 'past_due']
        },
        order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
        throw new AppError(
            'No active subscription found',
            404,
            'NO_ACTIVE_SUBSCRIPTION'
        );
    }

    // 2. Plan destino existe y está activo
    const newPlan = await Plan.findByPk(newPlanId);
    if (!newPlan || !newPlan.isActive) {
        throw new AppError('Plan not found or inactive', 404, 'PLAN_NOT_FOUND');
    }

    // 3. No es el mismo plan actual
    if (subscription.planId === newPlanId) {
        throw new AppError(
            'You are already subscribed to this plan',
            400,
            'SAME_PLAN'
        );
    }

    // 4. Plan actual (para audit + notes)
    const oldPlan = await Plan.findByPk(subscription.planId);
    const oldPlanCode = oldPlan?.code || 'unknown';
    const oldPlanId = subscription.planId;

    // 5. Período nuevo (30 días desde ahora)
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 6. Transacción
    const result = await sequelize.transaction(async (t) => {
        // 6.1. Actualizar suscripción
        await subscription.update({
            planId: newPlanId,
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            invoicesUsedThisMonth: 0
        }, { transaction: t });

        // 6.2. Crear pago pendiente
        const payment = await SubscriptionPayment.create({
            subscriptionId: subscription.id,
            companyId,
            amount: newPlan.priceDop,
            currency: 'DOP',
            paymentMethod: null,
            reference: null,
            periodStart: now,
            periodEnd,
            status: 'pending',
            paidAt: null,
            notes: `Plan change: ${oldPlanCode} → ${newPlan.code}`
        }, { transaction: t });

        // 6.3. Audit log
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser.id,
                action: 'subscription.plan_changed',
                entity: 'subscription',
                entityId: subscription.id,
                before: { planId: oldPlanId, planCode: oldPlanCode },
                after: {
                    planId: newPlanId,
                    planCode: newPlan.code,
                    paymentId: payment.id,
                    amount: payment.amount,
                    periodStart: now,
                    periodEnd
                },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return { payment };
    });

    // 7. Recargar subscription con el nuevo plan
    const updatedSubscription = await Subscription.findByPk(subscription.id, {
        include: [{ model: Plan, as: 'plan' }]
    });

    // 8. Notificar a todos los company_admin activos
    //    (template pendiente en módulo notifications)


    return {
        subscription: updatedSubscription,
        plan: newPlan,
        payment: result.payment
    };
}

module.exports = {
    getMySubscription,
    listMyPayments,
    changePlan
};