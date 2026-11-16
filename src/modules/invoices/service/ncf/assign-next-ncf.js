// ============================================================
// assign-next-ncf.js
// Asigna el siguiente e-NCF desde una secuencia activa.
// Incluye la notificación al dueño cuando no hay secuencia.
// ============================================================

const { Op } = require('sequelize');
const notifications = require('../../../notifications');
const notificationsConfig = require('../../../../config/notifications');
const sequelize = require('../../../../config/database');
const { Company, Sequence, AuditLog } = require('../../../../models');
const { AppError } = require('../../../../shared/middlewares/error.middleware');
const { ECF_TYPE_NAMES } = require('../helpers/constants');
const { buildNCF } = require('../../../../shared/utils/ncf');

// ------------------------------------------------------------
// Notificar al dueño cuando no se encuentra secuencia válida.
// Fire-and-forget: no bloquea la transacción ni el throw.
//
// Deduplicación: si el mismo user ya intentó el mismo tipo en
// las últimas 2 horas, NO se vuelve a enviar.
// ------------------------------------------------------------
async function notifyNoActiveSequence(companyId, type, reqUser) {
    // Sin reqUser no hay a quién notificar con contexto
    if (!reqUser || !reqUser.id) return;

    try {
        // 1. Deduplicar: buscar intento reciente en AuditLog
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const recent = await AuditLog.findOne({
            where: {
                userId: reqUser?.id ?? null,
                action: 'invoice.no_active_sequence_attempt',
                createdAt: { [Op.gte]: twoHoursAgo }
            },
            order: [['createdAt', 'DESC']]
        });

        // Si ya intentó el mismo tipo recientemente, no reenviar
        if (recent && recent.after && recent.after.type === type) {
            return;
        }

        // 2. Cargar empresa + owner
        const company = await Company.findByPk(companyId, {
            attributes: ['id', 'rnc', 'name', 'email']
        });

        if (!company) return;

        // 3. Destinatarios: el user que intentó + company.email
        const bcc = notificationsConfig.alerts.registrationNotifyEmail || undefined;
        const recipients = new Set();
        if (reqUser.email) recipients.add(reqUser.email);
        if (company.email) recipients.add(company.email);

        // 4. Nombre legible del tipo
        const typeName = ECF_TYPE_NAMES[String(type)] || null;

        // 5. Enviar a cada destinatario
        for (const to of recipients) {
            try {
                await notifications.sendNoActiveSequence({
                    to,
                    bcc,
                    companyName: company.name,
                    rnc: company.rnc,
                    ownerName: reqUser.firstName || null,
                    type,
                    typeName,
                    attemptedAt: new Date()
                });
            } catch (err) {
                console.error('[invoices.notifyNoActiveSequence] Send failed:', err.message);
            }
        }

        // 6. Registrar intento para deduplicar futuros avisos
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.no_active_sequence_attempt',
                entity: 'invoice',
                entityId: null,
                after: { type },
                ip: null,
                userAgent: null
            });
        } catch (err) {
            // Ignorar errores de audit — la notificación ya se envió
        }

    } catch (err) {
        // Nunca debe romper el flujo principal
        console.error('[invoices.notifyNoActiveSequence] Unexpected error:', err.message);
    }
}

// ------------------------------------------------------------
// Helper: asignar el siguiente e-NCF desde una secuencia activa
// TRANSACCIONAL — debe llamarse dentro de sequelize.transaction
// ------------------------------------------------------------
async function assignNextNCF(companyId, type, transaction, reqUser = null) {
    // 1. Buscar la secuencia activa, vigente, con números disponibles, ordenada por vencimiento
    const sequence = await Sequence.findOne({
        where: {
            companyId,
            type,
            isActive: true,
            expiresAt: { [Op.gt]: new Date() },
            currentNumber: { [Op.lt]: sequelize.literal('"Sequence"."end_number"') }
        },
        order: [['expiresAt', 'ASC'], ['createdAt', 'ASC']],
        lock: transaction.LOCK.UPDATE, // ← Lock pesimista
        transaction
    });

    // 2. Si no existe secuencia activa
    if (!sequence) {
        // Fire-and-forget: no await. La transacción va a abortar de todas formas
        // por el throw, así que no queremos bloquear esperando al SMTP.
        notifyNoActiveSequence(companyId, type, reqUser).catch(err => {
            console.error('[invoices.assignNextNCF] Alert dispatch failed:', err.message);
        });

        throw new AppError(
            `No active sequence found for type ${type}. Please register or activate one first.`,
            409,
            'NO_ACTIVE_SEQUENCE'
        );
    }

    // 3. Calcular siguiente número
    const currentNumber = Number(sequence.currentNumber);
    const endNumber = Number(sequence.endNumber);
    const nextNumber = currentNumber + 1;

    // 4. Verificar que no se haya agotado
    if (nextNumber > endNumber) {
        throw new AppError(
            `Sequence ${sequence.prefix}${sequence.type} is exhausted (reached ${endNumber})`,
            409,
            'SEQUENCE_EXHAUSTED'
        );
    }

    // 5. Actualizar currentNumber
    const willBeExhausted = nextNumber === endNumber;

    await sequence.update(
        {
            currentNumber: nextNumber,
            ...(willBeExhausted && { isActive: false })
        },
        { transaction }
    );

    // 6. Construir el e-NCF completo
   const ncf = buildNCF(sequence.prefix, sequence.type, nextNumber);

    return { sequence, ncf, nextNumber };
}

module.exports = {
    assignNextNCF,
    notifyNoActiveSequence
};