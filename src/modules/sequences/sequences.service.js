// ============================================================
// Servicio de secuencias
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Sequence, Invoice, AuditLog } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Listar MIS secuencias (company_admin)
// ------------------------------------------------------------
async function listMySequences(companyId, filters = {}) {
    
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // Construir where
    const where = { companyId };

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.prefix) {
        where.prefix = filters.prefix;
    }

    if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
    }

    // Filtro por vencimiento
    if (filters.expired !== undefined) {
        if (filters.expired === true) {
            where.expiresAt = { [Op.lt]: new Date() };
        } else {
            where.expiresAt = { [Op.gte]: new Date() };
        }
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await Sequence.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    // Enriquecer cada secuencia con campos calculados
    const now = new Date();
    const items = rows.map((seq) => {
        const data = seq.toJSON();
        const currentNumber = Number(data.currentNumber);
        const startNumber = Number(data.startNumber);
        const endNumber = Number(data.endNumber);

        // Números restantes (0 si ya se agotó)
        const remainingNumbers = Math.max(0, endNumber - currentNumber);

        // Total del rango
        const totalNumbers = endNumber - startNumber + 1;

        // Porcentaje usado (0-100)
        const usedNumbers = currentNumber - (startNumber - 1);
        const usedPercentage = totalNumbers > 0
            ? Math.min(100, Math.round((usedNumbers / totalNumbers) * 100))
            : 0;

        return {
            ...data,
            isExpired: new Date(data.expiresAt) < now,
            remainingNumbers,
            totalNumbers,
            usedPercentage
        };
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items,
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
    listMySequences
};