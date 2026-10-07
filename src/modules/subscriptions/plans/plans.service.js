// ============================================================
// Servicio de planes
// ============================================================

const { Plan, AuditLog } = require('../../../models');
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

module.exports = {
    listPlans,
    getPlanById,
    createPlan
};