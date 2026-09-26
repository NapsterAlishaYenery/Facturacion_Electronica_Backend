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

// ------------------------------------------------------------
// Ver una secuencia específica (company_admin)
// ------------------------------------------------------------
async function getMySequenceById(companyId, sequenceId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la secuencia (filtrando por companyId para multi-tenant)
    const sequence = await Sequence.findOne({
        where: {
            id: sequenceId,
            companyId
        }
    });

    // 2. Si no existe O es de otra empresa → mismo error (no revelar)
    if (!sequence) {
        throw new AppError('Sequence not found', 404, 'SEQUENCE_NOT_FOUND');
    }

    // 3. Contar facturas emitidas con esta secuencia
    const invoicesCount = await Invoice.count({
        where: { sequenceId: sequence.id }
    });

    // 4. Calcular campos derivados
    const data = sequence.toJSON();
    const currentNumber = Number(data.currentNumber);
    const startNumber = Number(data.startNumber);
    const endNumber = Number(data.endNumber);
    const now = new Date();

    const remainingNumbers = Math.max(0, endNumber - currentNumber);
    const totalNumbers = endNumber - startNumber + 1;
    const usedNumbers = currentNumber - (startNumber - 1);
    const usedPercentage = totalNumbers > 0
        ? Math.min(100, Math.round((usedNumbers / totalNumbers) * 100))
        : 0;

    // 5. Determinar si es editable/borrable
    const hasBeenUsed = currentNumber > startNumber - 1;

    return {
        sequence: {
            ...data,
            isExpired: new Date(data.expiresAt) < now,
            remainingNumbers,
            totalNumbers,
            usedPercentage,
            invoicesCount,
            hasBeenUsed,
            canBeEdited: !hasBeenUsed,
            canBeDeleted: !hasBeenUsed && invoicesCount === 0
        }
    };
}

module.exports = {
    listMySequences,
    getMySequenceById
};