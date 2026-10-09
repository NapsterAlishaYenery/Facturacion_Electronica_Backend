// ============================================================
// Servicio de suscripciones
// ============================================================
const { Op } = require('sequelize');
const {
    Subscription,
    SubscriptionPayment,
    Plan,
    User,
    Sequence,
    Company
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

// ------------------------------------------------------------
// Cancelar mi suscripción (company_admin)
// ------------------------------------------------------------
async function cancelMySubscription(companyId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar suscripción activa
    const subscription = await Subscription.findOne({
        where: {
            companyId,
            status: ['trial', 'active', 'past_due']
        },
        include: [{ model: Plan, as: 'plan' }],
        order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
        throw new AppError(
            'No active subscription found to cancel',
            404,
            'NO_ACTIVE_SUBSCRIPTION'
        );
    }

    // 2. Guardar estado anterior
    const before = {
        status: subscription.status,
        cancelledAt: subscription.cancelledAt,
        endsAt: subscription.endsAt
    };

    // 3. Calcular endsAt (fin de período actual)
    const now = new Date();
    const accessUntil = subscription.currentPeriodEnd ||
        subscription.trialEndsAt ||
        now;

    // 4. Actualizar
    await subscription.update({
        status: 'cancelled',
        cancelledAt: now,
        endsAt: accessUntil
    });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId,
            userId: reqUser.id,
            action: 'subscription.cancelled',
            entity: 'subscription',
            entityId: subscription.id,
            before,
            after: {
                status: 'cancelled',
                cancelledAt: now,
                endsAt: accessUntil
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // 6. Notificación (placeholder — módulo notifications lo hará después)
    // Notificar a todos los company_admin activos de la empresa

    // 7. Calcular días restantes
    const daysLeft = accessUntil
        ? Math.max(0, Math.floor((new Date(accessUntil).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : 0;

    return {
        subscription,
        plan: subscription.plan,
        accessUntil,
        daysLeft
    };
}

// ------------------------------------------------------------
// Listar TODAS las suscripciones (admin)
// ------------------------------------------------------------
async function listSubscriptions(filters = {}) {
    const where = {};

    // Filtros opcionales
    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.planId) {
        where.planId = filters.planId;
    }

    if (filters.companyId) {
        where.companyId = filters.companyId;
    }

     // Búsqueda por RNC o nombre de la empresa
    let companyWhere;
    if (filters.search) {
        companyWhere = {
            [Op.or]: [
                { rnc: { [Op.iLike]: `%${filters.search}%` } },
                { name: { [Op.iLike]: `%${filters.search}%` } },
                { tradeName: { [Op.iLike]: `%${filters.search}%` } }
            ]
        };
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Query
    const { count, rows } = await Subscription.findAndCountAll({
        where,
        include: [
            {
                model: Company,
                as: 'company',
                required: !!filters.search,
                //where: Object.keys(companyWhere).length > 0 ? companyWhere : undefined,
                where: companyWhere,
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'isActive']
            },
            {
                model: Plan,
                as: 'plan',
                attributes: [
                    'id', 'code', 'name', 'priceDop', 'priceUsd',
                    'invoicesPerMonth', 'maxUsers', 'maxSequences'
                ]
            }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
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
// Ver una suscripción específica (admin)
// ------------------------------------------------------------
async function getSubscriptionById(subscriptionId) {
    // 1. Buscar la suscripción con sus relaciones
    const subscription = await Subscription.findByPk(subscriptionId, {
        include: [
            {
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'isActive']
            },
            {
                model: Plan,
                as: 'plan'
            },
            {
                model: SubscriptionPayment,
                as: 'payments',
                separate: true,
                limit: 10,
                order: [['createdAt', 'DESC']]
            }
        ]
    });

    if (!subscription) {
        throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // 2. Contar uso actual
    const usersCount = await User.count({
        where: { companyId: subscription.companyId, isActive: true }
    });
    const sequencesCount = await Sequence.count({
        where: { companyId: subscription.companyId, isActive: true }
    });

    // 3. Construir bloque de uso
    const plan = subscription.plan;
    const usedInvoices = Number(subscription.invoicesUsedThisMonth) || 0;

    const usage = {
        invoices: buildUsageBlock(usedInvoices, plan?.invoicesPerMonth ?? 0),
        users: buildUsageBlock(usersCount, plan?.maxUsers ?? 0),
        sequences: buildUsageBlock(sequencesCount, plan?.maxSequences ?? 0)
    };

    // 4. Vencimiento y días restantes
    const expiresAt = getEffectiveExpiry(subscription);
    const daysLeft = expiresAt
        ? Math.max(0, daysUntil(expiresAt))
        : 0;

    return {
        subscription,
        company: subscription.company,
        plan,
        payments: subscription.payments || [],
        usage,
        expiresAt,
        daysLeft
    };
}

// ------------------------------------------------------------
// Actualizar una suscripción (admin)
// ------------------------------------------------------------
async function updateSubscriptionById(subscriptionId, updates, reqUser, reqInfo = {}) {
    // 1. Buscar la suscripción
    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription) {
        throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // 2. Filtrar solo campos editables
    const allowedFields = [
        'status', 'trialEndsAt', 'currentPeriodStart', 'currentPeriodEnd',
        'endsAt', 'cancelledAt', 'invoicesUsedThisMonth'
    ];

    const updateData = {};
    const before = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            // Comparación tolerante: números y fechas se comparan por valor
            const oldVal = subscription[field];
            const newVal = updates[field];

            const changed = (() => {
                if (oldVal === newVal) return false;
                // Fechas: comparar timestamps
                if (oldVal instanceof Date && newVal instanceof Date) {
                    return oldVal.getTime() !== newVal.getTime();
                }
                if (oldVal instanceof Date && typeof newVal === 'string') {
                    return oldVal.getTime() !== new Date(newVal).getTime();
                }
                // Números: puede venir string, comparar como número
                if (typeof oldVal === 'number' || typeof newVal === 'number') {
                    return Number(oldVal) !== Number(newVal);
                }
                return true;
            })();

            if (changed) {
                before[field] = oldVal;
                updateData[field] = newVal;
            }
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError(
            'No changes detected. Provide at least one field with a different value.',
            400,
            'NO_CHANGES_DETECTED'
        );
    }

    // 3. Auto-seteos según el nuevo status
    const newStatus = updateData.status;

    if (newStatus === 'cancelled') {
        if (updateData.cancelledAt === undefined && !subscription.cancelledAt) {
            updateData.cancelledAt = new Date();
        }
        if (updateData.endsAt === undefined && !subscription.endsAt) {
            updateData.endsAt = subscription.currentPeriodEnd || subscription.trialEndsAt || new Date();
        }
    }

    // Reactivación: cancelled/expired → active/trial/past_due
    if (newStatus === 'active' || newStatus === 'trial' || newStatus === 'past_due') {
        const oldStatus = subscription.status;
        if (oldStatus === 'cancelled' || oldStatus === 'expired') {
            // Resetear flags de cancelación
            if (updateData.cancelledAt === undefined) updateData.cancelledAt = null;
            if (updateData.endsAt === undefined) updateData.endsAt = null;
        }
    }

    // 4. Actualizar
    await subscription.update(updateData);

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: subscription.companyId,
            userId: reqUser.id,
            action: 'subscription.updated_by_admin',
            entity: 'subscription',
            entityId: subscription.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return subscription;
}

// ------------------------------------------------------------
// Registrar un pago (admin)
// ------------------------------------------------------------
async function registerPayment(subscriptionId, data, reqUser, reqInfo = {}) {
    // 1. Buscar la suscripción
    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription) {
        throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // 2. Preparar datos del pago
    const now = new Date();
    const isPaid = data.status === 'paid';

    const paymentData = {
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        amount: data.amount,
        currency: data.currency || 'DOP',
        paymentMethod: data.paymentMethod ?? null,
        reference: data.reference ?? null,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        status: data.status || 'pending',
        paidAt: isPaid
            ? (data.paidAt ? new Date(data.paidAt) : now)
            : (data.paidAt ? new Date(data.paidAt) : null),
        notes: data.notes ?? null
    };

    // 3. Guardar before de la suscripción si va a cambiar
    const subscriptionBefore = isPaid ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        invoicesUsedThisMonth: subscription.invoicesUsedThisMonth,
        cancelledAt: subscription.cancelledAt,
        endsAt: subscription.endsAt
    } : null;

    // 4. Transacción
    const result = await sequelize.transaction(async (t) => {
        // 4.1. Crear pago
        const payment = await SubscriptionPayment.create(paymentData, { transaction: t });

        // 4.2. Si está 'paid', reactivar la suscripción
        if (isPaid) {
            await subscription.update({
                status: 'active',
                currentPeriodStart: paymentData.periodStart,
                currentPeriodEnd: paymentData.periodEnd,
                invoicesUsedThisMonth: 0,
                cancelledAt: null,
                endsAt: null
            }, { transaction: t });
        }

        // 4.3. Audit log
        try {
            await AuditLog.create({
                companyId: subscription.companyId,
                userId: reqUser.id,
                action: 'subscription.payment_registered',
                entity: 'subscription_payment',
                entityId: payment.id,
                before: subscriptionBefore,
                after: isPaid ? {
                    paymentId: payment.id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: payment.status,
                    periodStart: payment.periodStart,
                    periodEnd: payment.periodEnd,
                    subscriptionStatus: 'active'
                } : {
                    paymentId: payment.id,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: payment.status
                },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return payment;
    });

    // 5. Recargar subscription (puede haber cambiado)
    const updatedSubscription = await Subscription.findByPk(subscriptionId);

    return {
        payment: result,
        subscription: updatedSubscription
    };
}

// ------------------------------------------------------------
// Listar pagos de una suscripción (admin)
// ------------------------------------------------------------
async function listSubscriptionPayments(subscriptionId, filters = {}) {
    // 1. Verificar que la suscripción existe
    const subscription = await Subscription.findByPk(subscriptionId, {
        attributes: ['id', 'companyId', 'planId', 'status']
    });

    if (!subscription) {
        throw new AppError('Subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND');
    }

    // 2. Filtros
    const where = { subscriptionId };
    if (filters.status) {
        where.status = filters.status;
    }

    // 3. Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // 4. Query
    const { count, rows } = await SubscriptionPayment.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);

    return {
        subscription,
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