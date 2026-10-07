// ============================================================
// Servicio de planes
// ============================================================

const { Plan } = require('../../../models');

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

module.exports = {
    listPlans
};