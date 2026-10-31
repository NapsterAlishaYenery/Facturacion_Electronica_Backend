// ============================================================
// Servicio de auditoría
// Solo lectura: listado paginado con filtros.
// Los audit logs NO se editan ni se borran desde aquí.
// ============================================================

const { Op } = require('sequelize');
const { AuditLog, Company, User } = require('../../models');

// ------------------------------------------------------------
// Listado paginado con filtros
// ------------------------------------------------------------
async function listAuditLogs(filters = {}) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const where = {};

    // 1. Filtros directos
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.entity) where.entity = filters.entity;

    // 2. action: prefijo (ej: "user." trae user.login, user.created...)
    if (filters.action) {
        where.action = { [Op.iLike]: `${filters.action}%` };
    }

    // 3. Preset "solo jobs"
    if (filters.onlyJobs === true) {
        where.action = { [Op.iLike]: 'job.%' };
    }

    // 4. Búsqueda libre en action o entity
    if (filters.search) {
        where[Op.or] = [
            { action: { [Op.iLike]: `%${filters.search}%` } },
            { entity: { [Op.iLike]: `%${filters.search}%` } }
        ];
    }

    // 5. Rango de fechas
    if (filters.from || filters.to) {
        where.createdAt = {};
        if (filters.from) where.createdAt[Op.gte] = new Date(filters.from);
        if (filters.to) where.createdAt[Op.lte] = new Date(filters.to);
    }

    // 6. Query paginada
    const { count, rows } = await AuditLog.findAndCountAll({
        where,
        include: [
            {
                model: Company,
                as: 'company',
                required: false,
                attributes: ['id', 'name', 'rnc']
            },
            {
                model: User,
                as: 'user',
                required: false,
                attributes: ['id', 'email', 'firstName', 'lastName', 'role']
            }
        ],
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
// Lista de actions distintas (para poblar <select> de filtros)
// Cache en memoria 5 min para no pegarle a BD en cada request.
// ------------------------------------------------------------
let _actionsCache = { data: null, expiresAt: 0 };
const ACTIONS_CACHE_MS = 5 * 60 * 1000;

async function listDistinctActions() {
    const now = Date.now();
    if (_actionsCache.data && _actionsCache.expiresAt > now) {
        return _actionsCache.data;
    }

    const rows = await AuditLog.findAll({
        attributes: ['action'],
        group: ['action'],
        order: [['action', 'ASC']],
        raw: true
    });

    const actions = rows.map(r => r.action);
    _actionsCache = { data: actions, expiresAt: now + ACTIONS_CACHE_MS };
    return actions;
}

module.exports = {
    listAuditLogs,
    listDistinctActions
};