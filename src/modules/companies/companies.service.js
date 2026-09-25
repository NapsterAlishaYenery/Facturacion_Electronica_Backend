// ============================================================
// Servicio de empresas
// Contiene TODA la lógica de negocio del módulo companies
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Company, User, Subscription, Plan, Sequence, Invoice, AuditLog } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Obtener mi empresa (con suscripción, plan y conteos)
// ------------------------------------------------------------
async function getMyCompany(companyId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company. Admins must use GET /api/companies/:id',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [
            {
                model: Subscription,
                as: 'subscriptions',
                where: { status: ['trial', 'active', 'past_due'] },
                required: false,
                limit: 1,
                order: [['createdAt', 'DESC']],
                include: [{
                    model: Plan,
                    as: 'plan',
                    attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth', 'maxUsers', 'maxSequences', 'features']
                }]
            }
        ]
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Contar usuarios activos
    const usersCount = await User.count({
        where: { companyId, isActive: true }
    });

    // 3. Contar secuencias activas
    const sequencesCount = await Sequence.count({
        where: { companyId, isActive: true }
    });

    // 4. Extraer la suscripción (viene como array por el hasMany)
    const subscriptions = company.subscriptions || [];
    const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // 5. Construir la respuesta
    const companyData = company.toJSON();
    delete companyData.subscriptions; // Limpiar el array crudo

    return {
        company: companyData,
        subscription: currentSubscription,
        plan: currentSubscription?.plan || null,
        stats: {
            usersCount,
            sequencesCount
        }
    };
}

// ------------------------------------------------------------
// Actualizar mi empresa
// ------------------------------------------------------------
async function updateMyCompany(companyId, updates, reqUser, reqInfo = {}) {
    // 1. Verificar que el usuario tenga empresa
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 2. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 3. Verificar que esté activa (no se puede editar una suspendida)
    if (!company.isActive) {
        throw new AppError('Company is inactive', 403, 'COMPANY_INACTIVE');
    }

    // 4. Guardar estado anterior para audit (solo campos editables)
    const before = {
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        phone: company.phone,
        address: company.address,
        economicActivity: company.economicActivity
    };

    // 5. Filtrar campos permitidos (doble protección)
    const allowedFields = ['name', 'tradeName', 'email', 'phone', 'address', 'economicActivity'];
    const updateData = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 6. Actualizar
    await company.update(updateData);

    // 7. Audit log
    try {
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action: 'company.updated',
            entity: 'company',
            entityId: company.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return company;
}

// ------------------------------------------------------------
// Listar TODAS las empresas (solo admin)
// ------------------------------------------------------------
async function listCompanies(filters = {}) {
    const where = {};

    // Filtros opcionales
    if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
    }

    if (filters.dgiiEnvironment) {
        where.dgiiEnvironment = filters.dgiiEnvironment;
    }

    // Búsqueda por RNC o nombre (case-insensitive)
    if (filters.search) {
        where[Op.or] = [
            { rnc: { [Op.iLike]: `%${filters.search}%` } },
            { name: { [Op.iLike]: `%${filters.search}%` } },
            { tradeName: { [Op.iLike]: `%${filters.search}%` } }
        ];
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Query con conteo
    const { count, rows } = await Company.findAndCountAll({
        where,
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [{
            model: Subscription,
            as: 'subscriptions',
            where: { status: ['trial', 'active', 'past_due'] },
            required: false,
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Plan,
                as: 'plan',
                attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth']
            }]
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true  // Necesario con includes para contar correctamente
    });

    const totalPages = Math.ceil(count / limit);

    // Normalizar la respuesta (quitar el array crudo de subscriptions)
    const companies = rows.map((company) => {
        const data = company.toJSON();
        const subscriptions = data.subscriptions || [];
        const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

        delete data.subscriptions;

        return {
            ...data,
            subscription: currentSubscription,
            plan: currentSubscription?.plan || null
        };
    });

    return {
        items: companies,
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
// Ver una empresa específica (solo admin)
// ------------------------------------------------------------
async function getCompanyById(companyId) {
    // 1. Buscar la empresa con sus relaciones
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [{
            model: Subscription,
            as: 'subscriptions',
            where: { status: ['trial', 'active', 'past_due'] },
            required: false,
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Plan,
                as: 'plan',
                attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth', 'maxUsers', 'maxSequences', 'features']
            }]
        }]
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Contar usuarios activos
    const usersCount = await User.count({
        where: { companyId, isActive: true }
    });

    // 3. Contar secuencias activas
    const sequencesCount = await Sequence.count({
        where: { companyId, isActive: true }
    });

    // 4. Extraer la suscripción actual
    const subscriptions = company.subscriptions || [];
    const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // 5. Construir la respuesta
    const companyData = company.toJSON();
    delete companyData.subscriptions;

    return {
        company: companyData,
        subscription: currentSubscription,
        plan: currentSubscription?.plan || null,
        stats: {
            usersCount,
            sequencesCount
        }
    };
}

// ------------------------------------------------------------
// Actualizar cualquier empresa (solo admin)
// ------------------------------------------------------------
async function updateCompanyById(companyId, updates, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId);
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Guardar estado anterior para audit
    const before = {
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        phone: company.phone,
        address: company.address,
        economicActivity: company.economicActivity,
        dgiiEnvironment: company.dgiiEnvironment,
        isActive: company.isActive
    };

    // 3. Filtrar campos permitidos (doble protección)
    const allowedFields = [
        'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity',
        'dgiiEnvironment', 'isActive'
    ];
    const updateData = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 4. Actualizar
    await company.update(updateData);

    const safeCompany = await Company.findByPk(company.id, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: safeCompany.id,
            userId: reqUser.id,
            action: 'company.updated_by_admin',
            entity: 'company',
            entityId: safeCompany.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return safeCompany;
}

// ------------------------------------------------------------
// Activar/desactivar empresa (solo admin)
// ------------------------------------------------------------
async function toggleCompanyActive(companyId, isActive, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Idempotencia: si ya está en el estado deseado, no hacer nada
    //    (pero sí retornar la empresa por consistencia)
    if (company.isActive === isActive) {
        return company;
    }

    // 3. Guardar estado anterior
    const before = {
        isActive: company.isActive
    };

    // 4. Actualizar
    await company.update({ isActive });

    // 5. Audit log con acción específica
    const action = isActive ? 'company.activated' : 'company.deactivated';
    try {
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action,
            entity: 'company',
            entityId: company.id,
            before,
            after: { isActive },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return company;
}

// ------------------------------------------------------------
// Borrar empresa (solo admin, hard delete)
// ------------------------------------------------------------
async function deleteCompany(companyId, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Verificar que NO tenga facturas emitidas
    const invoicesCount = await Invoice.count({
        where: { companyId }
    });

    if (invoicesCount > 0) {
        throw new AppError(
            `Cannot delete company with ${invoicesCount} issued invoice(s). Deactivate it instead using PATCH /api/companies/${companyId}/activate with { isActive: false }.`,
            409,
            'COMPANY_HAS_INVOICES'
        );
    }

    // 3. Guardar datos para audit
    const before = {
        id: company.id,
        rnc: company.rnc,
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        isActive: company.isActive,
        dgiiEnvironment: company.dgiiEnvironment
    };

    // 4. Borrar en transacción
    await sequelize.transaction(async (t) => {
        const usersCount = await User.count({ where: { companyId }, transaction: t });
        const sequencesCount = await Sequence.count({ where: { companyId }, transaction: t });
        const subscriptionsCount = await Subscription.count({ where: { companyId }, transaction: t });

        // Audit log ANTES del destroy
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action: 'company.deleted',
            entity: 'company',
            entityId: company.id,
            before,
            after: {
                deleted: true,
                stats: {
                    usersCount,
                    sequencesCount,
                    subscriptionsCount
                }
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        }, { transaction: t });

        // Destroy con cascade
        await company.destroy({ transaction: t });
    });

    return {
        deleted: true,
        before,
        cascadeDeleted: {
            users: true,
            subscriptions: true,
            sequences: true
        }
    };
}

module.exports = {
    getMyCompany,
    updateMyCompany,
    listCompanies,
    getCompanyById,
    updateCompanyById,
    toggleCompanyActive,
    deleteCompany
};