// ============================================================
// Servicio de empresas
// Contiene TODA la lógica de negocio del módulo companies
// ============================================================

const { Op } = require('sequelize');
const { Company, User, Subscription, Plan, Sequence, AuditLog } = require('../../models');
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

module.exports = {
    getMyCompany
};