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

// ------------------------------------------------------------
// Crear secuencia (company_admin)
// ------------------------------------------------------------
async function createMySequence(companyId, data, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const { type, prefix = 'E', startNumber, endNumber, expiresAt } = data;

    // 1. Convertir los strings de 10 dígitos a números
    const startInt = parseInt(startNumber, 10);
    const endInt = parseInt(endNumber, 10);

    // 2. Validar rango
    if (endInt <= startInt) {
        throw new AppError('endNumber must be greater than startNumber', 400, 'INVALID_RANGE');
    }

    const rangeSize = endInt - startInt + 1;
    if (rangeSize > 1000000) {
        throw new AppError('Range cannot exceed 1,000,000 numbers', 400, 'RANGE_TOO_LARGE');
    }

    // 3. Verificar que no haya otra secuencia activa del mismo tipo
    const overlapping = await Sequence.findOne({
        where: {
            companyId,
            type,
            prefix,
            isActive: true,
            [Op.or]: [
                { startNumber: { [Op.lte]: startInt }, endNumber: { [Op.gte]: startInt } },
                { startNumber: { [Op.lte]: endInt }, endNumber: { [Op.gte]: endInt } },
                { startNumber: { [Op.gte]: startInt }, endNumber: { [Op.lte]: endInt } }
            ]
        }
    });

    if (overlapping) {
        throw new AppError(
            `This range overlaps with an existing active sequence for type ${type}. Deactivate it first or use a different range.`,
            409,
            'RANGE_OVERLAPS'
        );
    }

    // 4. Crear la secuencia
    const sequence = await Sequence.create({
        companyId,
        type,
        prefix,
        startNumber: startInt,
        endNumber: endInt,
        currentNumber: startInt - 1,  // Aún no se ha usado nada
        expiresAt,
        isActive: true
    });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId,
            userId: reqUser.id,
            action: 'sequence.created',
            entity: 'sequence',
            entityId: sequence.id,
            after: {
                type: sequence.type,
                prefix: sequence.prefix,
                startNumber: startInt,
                endNumber: endInt,
                expiresAt
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // 6. Devolver con campos calculados
    const data2 = sequence.toJSON();
    const now = new Date();
    const currentNumber = Number(data2.currentNumber);
    const startNumberResp = Number(data2.startNumber);
    const endNumberResp = Number(data2.endNumber);

    return {
        sequence: {
            ...data2,
            isExpired: new Date(data2.expiresAt) < now,
            remainingNumbers: Math.max(0, endNumberResp - currentNumber),
            totalNumbers: endNumberResp - startNumberResp + 1,
            usedPercentage: 0,
            invoicesCount: 0,
            hasBeenUsed: false,
            canBeEdited: true,
            canBeDeleted: true
        }
    };
}

module.exports = {
    listMySequences,
    getMySequenceById,
    createMySequence
};