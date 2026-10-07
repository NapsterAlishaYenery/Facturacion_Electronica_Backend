// ============================================================
// Servicio de planes
// ============================================================

const { Plan, Subscription, AuditLog } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Listar planes activos (público)
// ------------------------------------------------------------
async function listPlans(filters = {}) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await Plan.findAndCountAll({
        where: { isActive: true },
        order: [['priceDop', 'ASC']],
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
// Obtener un plan por ID (público)
// ------------------------------------------------------------
async function getPlanById(planId) {
    const plan = await Plan.findOne({
        where: { id: planId, isActive: true }
    });

    if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    return plan;
}

// ------------------------------------------------------------
// Crear un plan (admin)
// ------------------------------------------------------------
async function createPlan(data, reqUser, reqInfo = {}) {
    // 1. Verificar que el code no exista (mejor UX que el unique constraint)
    const existing = await Plan.findOne({ where: { code: data.code } });
    if (existing) {
        throw new AppError(
            `A plan with code "${data.code}" already exists`,
            409,
            'PLAN_CODE_ALREADY_EXISTS'
        );
    }

    // 2. Crear el plan
    const plan = await Plan.create({
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        priceDop: data.priceDop,
        priceUsd: data.priceUsd ?? null,
        invoicesPerMonth: data.invoicesPerMonth,
        maxUsers: data.maxUsers,
        maxSequences: data.maxSequences,
        features: data.features ?? null,
        isActive: true
    });

    // 3. Audit log
    try {
        await AuditLog.create({
            companyId: null,
            userId: reqUser.id,
            action: 'plan.created',
            entity: 'plan',
            entityId: plan.id,
            after: {
                code: plan.code,
                name: plan.name,
                priceDop: plan.priceDop,
                priceUsd: plan.priceUsd,
                invoicesPerMonth: plan.invoicesPerMonth,
                maxUsers: plan.maxUsers,
                maxSequences: plan.maxSequences,
                isActive: plan.isActive
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return plan;
}

// ------------------------------------------------------------
// Actualizar un plan (admin)
// ------------------------------------------------------------
async function updatePlanById(planId, updates, reqUser, reqInfo = {}) {
    // 1. Buscar el plan
    const plan = await Plan.findByPk(planId);
    if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // 2. Si cambia el code, verificar que no choque con otro plan
    if (updates.code && updates.code !== plan.code) {
        const existing = await Plan.findOne({ where: { code: updates.code } });
        if (existing) {
            throw new AppError(
                `A plan with code "${updates.code}" already exists`,
                409,
                'PLAN_CODE_ALREADY_EXISTS'
            );
        }
    }

    // 3. Filtrar solo campos editables (doble protección)
    const allowedFields = [
        'code', 'name', 'description', 'priceDop', 'priceUsd',
        'invoicesPerMonth', 'maxUsers', 'maxSequences', 'features'
    ];
    const updateData = {};
    const before = {};

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            // Guardar before solo si realmente cambia
            if (plan[field] !== updates[field]) {
                before[field] = plan[field];
                updateData[field] = updates[field];
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

    // 4. Actualizar
    await plan.update(updateData);

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: null,
            userId: reqUser.id,
            action: 'plan.updated',
            entity: 'plan',
            entityId: plan.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return plan;
}

// ------------------------------------------------------------
// Desactivar un plan (admin, soft delete)
// ------------------------------------------------------------
async function deletePlan(planId, reqUser, reqInfo = {}) {
    // 1. Buscar el plan
    const plan = await Plan.findByPk(planId);
    if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // 2. Idempotencia: si ya está inactivo, no hacemos nada
    if (!plan.isActive) {
        return plan;
    }

    // 3. Verificar que no haya suscripciones en uso con este plan
    const inUseCount = await Subscription.count({
        where: {
            planId,
            status: ['trial', 'active', 'past_due']
        }
    });

    if (inUseCount > 0) {
        throw new AppError(
            `Cannot delete plan. It is currently in use by ${inUseCount} subscription(s).`,
            409,
            'PLAN_IN_USE'
        );
    }

    // 4. Soft delete
    await plan.update({ isActive: false });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: null,
            userId: reqUser.id,
            action: 'plan.deleted',
            entity: 'plan',
            entityId: plan.id,
            before: { isActive: true },
            after: { isActive: false },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return plan;
}

module.exports = {
    listPlans,
    getPlanById,
    createPlan,
    updatePlanById,
    deletePlan
};