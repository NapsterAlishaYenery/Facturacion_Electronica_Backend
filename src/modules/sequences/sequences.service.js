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

// ------------------------------------------------------------
// Actualizar una secuencia (company_admin)
// ------------------------------------------------------------
async function updateMySequence(companyId, sequenceId, updates, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la secuencia (aislamiento multi-tenant)
    const sequence = await Sequence.findOne({
        where: { id: sequenceId, companyId }
    });

    if (!sequence) {
        throw new AppError('Sequence not found', 404, 'SEQUENCE_NOT_FOUND');
    }

    // 2. Determinar si está en un estado inmutable (ya se usó)
    const currentNumber = Number(sequence.currentNumber);
    const currentStartNumber = Number(sequence.startNumber);
    const hasBeenUsed = currentNumber > currentStartNumber - 1;

    // 3. Guardar estado anterior para audit
    const before = {
        startNumber: currentStartNumber,
        endNumber: Number(sequence.endNumber),
        expiresAt: sequence.expiresAt
    };

    // 4. Construir los datos a actualizar
    const updateData = {};

    // 4.1. Validar si intenta cambiar startNumber o endNumber
    const isChangingRange =
        updates.startNumber !== undefined ||
        updates.endNumber !== undefined;

    if (isChangingRange) {
        if (hasBeenUsed) {
            throw new AppError(
                'Cannot modify startNumber or endNumber: sequence has already been used to emit invoices',
                409,
                'SEQUENCE_RANGE_IMMUTABLE'
            );
        }

        // Convertir a números si vienen
        const newStart = updates.startNumber !== undefined
            ? parseInt(updates.startNumber, 10)
            : currentStartNumber;
        const newEnd = updates.endNumber !== undefined
            ? parseInt(updates.endNumber, 10)
            : Number(sequence.endNumber);

        // Validar rango
        if (newEnd <= newStart) {
            throw new AppError('endNumber must be greater than startNumber', 400, 'INVALID_RANGE');
        }

        const rangeSize = newEnd - newStart + 1;
        if (rangeSize > 1000000) {
            throw new AppError('Range cannot exceed 1,000,000 numbers', 400, 'RANGE_TOO_LARGE');
        }

        // Validar solapamiento (excluyendo esta misma secuencia)
        const overlapping = await Sequence.findOne({
            where: {
                companyId,
                type: sequence.type,
                prefix: sequence.prefix,
                isActive: true,
                id: { [Op.ne]: sequence.id },  // ← excluir esta misma
                [Op.or]: [
                    { startNumber: { [Op.lte]: newStart }, endNumber: { [Op.gte]: newStart } },
                    { startNumber: { [Op.lte]: newEnd }, endNumber: { [Op.gte]: newEnd } },
                    { startNumber: { [Op.gte]: newStart }, endNumber: { [Op.lte]: newEnd } }
                ]
            }
        });

        if (overlapping) {
            throw new AppError(
                `This range overlaps with an existing active sequence for type ${sequence.type}`,
                409,
                'RANGE_OVERLAPS'
            );
        }

        updateData.startNumber = newStart;
        updateData.endNumber = newEnd;
    }

    // 4.2. expiresAt siempre editable (si es futuro)
    if (updates.expiresAt !== undefined) {
        updateData.expiresAt = updates.expiresAt;
    }

    // 5. Validar que al menos un campo se actualice
    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 6. Actualizar
    await sequence.update(updateData);

    // 7. Audit log
    try {
        await AuditLog.create({
            companyId,
            userId: reqUser.id,
            action: 'sequence.updated',
            entity: 'sequence',
            entityId: sequence.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // 8. Devolver con campos calculados
    const data = sequence.toJSON();
    const now = new Date();
    const newCurrentNumber = Number(data.currentNumber);
    const newStartNumber = Number(data.startNumber);
    const newEndNumber = Number(data.endNumber);

    const remainingNumbers = Math.max(0, newEndNumber - newCurrentNumber);
    const totalNumbers = newEndNumber - newStartNumber + 1;
    const usedNumbers = newCurrentNumber - (newStartNumber - 1);
    const usedPercentage = totalNumbers > 0
        ? Math.min(100, Math.round((usedNumbers / totalNumbers) * 100))
        : 0;

    return {
        sequence: {
            ...data,
            isExpired: new Date(data.expiresAt) < now,
            remainingNumbers,
            totalNumbers,
            usedPercentage,
            hasBeenUsed,
            canBeEdited: !hasBeenUsed,
            canBeDeleted: !hasBeenUsed
        }
    };
}

module.exports = {
    listMySequences,
    getMySequenceById,
    createMySequence,
    updateMySequence
};