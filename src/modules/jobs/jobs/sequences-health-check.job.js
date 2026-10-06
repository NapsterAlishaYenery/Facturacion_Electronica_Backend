// ============================================================
// Job: sequences-health-check
//
// Detecta secuencias NCF que:
//   1. Están próximas a vencer (≤30 días)
//   2. Tienen poco stock disponible (≤10 números o ≤10% del rango)
//
// Notifica 1 correo por empresa con todas sus secuencias afectadas.
// NO desactiva secuencias — eso lo hace assignNextNCF en runtime
// cuando el usuario intenta facturar.
//
// Corre diario a las 00:05 (timezone RD).
//
// Renombrado de "check-expiring-sequences" en Fase 6 Step 6.8.
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../../config/database');
const { Sequence, Company, User } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');

const JOB_NAME = 'sequences-health-check';
const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_WINDOW_DAYS = 30;

// ------------------------------------------------------------
// Umbrales de "poco stock" (se aplica el que se cumpla primero)
// ------------------------------------------------------------
const LOW_STOCK_ABSOLUTE = 10;          // ≤10 números restantes
const LOW_STOCK_PERCENTAGE = 0.10;      // ≤10% del rango total

// ------------------------------------------------------------
// Días clave para disparar el aviso de "por vencer"
// ------------------------------------------------------------
const KEY_DAYS = new Set([30, 15, 7, 3, 1]);

// ------------------------------------------------------------
// Días completos restantes (mismo helper que certificate-expiring)
// ------------------------------------------------------------
function daysUntil(targetDate, now = new Date()) {
    const diff = new Date(targetDate).getTime() - now.getTime();
    return diff >= 0
        ? Math.floor(diff / DAY_MS)
        : Math.ceil(diff / DAY_MS);
}

// ------------------------------------------------------------
// Clasificar secuencia: 'expiring' | 'lowStock' | null
// ------------------------------------------------------------
function classifySequence(seq, now) {
    const remaining = Number(seq.endNumber) - Number(seq.currentNumber);
    const totalRange = Number(seq.endNumber) - Number(seq.startNumber) + 1;
    const daysLeft = daysUntil(seq.expiresAt, now);

    // 1. Por vencer (solo en días clave)
    if (KEY_DAYS.has(daysLeft)) {
        return 'expiring';
    }

    // 2. Poco stock (solo si aún vigente)
    if (daysLeft >= 0) {
        const isLowStock =
            remaining <= LOW_STOCK_ABSOLUTE ||
            remaining <= totalRange * LOW_STOCK_PERCENTAGE;

        if (isLowStock && remaining >= 0) {
            return 'lowStock';
        }
    }

    return null;
}

// ------------------------------------------------------------
// Determinar el reason agregado para el correo
// ------------------------------------------------------------
function aggregateReason(sequences) {
    const hasExpiring = sequences.some(s => s.reason === 'expiring');
    const hasLowStock = sequences.some(s => s.reason === 'lowStock');

    if (hasExpiring && hasLowStock) return 'mixed';
    if (hasExpiring) return 'expiring';
    return 'lowStock';
}

// ------------------------------------------------------------
// Lógica principal
// ------------------------------------------------------------
async function runSequencesHealthCheck() {
    const now = new Date();
    const cutoff = new Date(now.getTime() + ALERT_WINDOW_DAYS * DAY_MS);

    // 1. Query: secuencias activas que cumplen AL MENOS una condición
    //
    //    - Por vencer: expiresAt <= cutoff (usa índice expires_at)
    //    - Poco stock: (end_number - current_number) <= LOW_STOCK_ABSOLUTE
    //
    //    Se filtra en JS el porcentaje adicional (10%) porque
    //    Sequelize no puede hacerlo bien en el WHERE con columnas.
    const sequences = await Sequence.findAll({
        where: {
            isActive: true,
            [Op.or]: [
                // A) Por vencer
                {
                    expiresAt: { [Op.ne]: null, [Op.lte]: cutoff }
                },
                // B) Poco stock (comparación absoluta en SQL)
                sequelize.literal(
                    `("end_number" - "current_number") <= ${LOW_STOCK_ABSOLUTE}`
                )
            ]
        },
        include: [{
            model: Company,
            as: 'company',
            required: true,
            include: [{
                model: User,
                as: 'users',
                where: { role: 'company_admin', isActive: true },
                required: false,
                attributes: ['id', 'email', 'firstName']
            }]
        }]
    });

    // 2. Clasificar y agrupar por empresa
    const byCompany = new Map();
    for (const seq of sequences) {
        const reason = classifySequence(seq, now);
        if (!reason) continue;

        const companyId = seq.companyId;
        if (!byCompany.has(companyId)) {
            byCompany.set(companyId, {
                company: seq.company,
                sequences: []
            });
        }

        byCompany.get(companyId).sequences.push({
            id: seq.id,
            type: seq.type,
            prefix: seq.prefix,
            startNumber: seq.startNumber,
            endNumber: seq.endNumber,
            currentNumber: seq.currentNumber,
            expiresAt: seq.expiresAt,
            reason
        });
    }

    // 3. Enviar 1 correo por empresa
    let affected = 0;
    const notified = [];
    const notifyBcc = notificationsConfig.alerts.registrationNotifyEmail;

    for (const [companyId, { company, sequences: seqs }] of byCompany) {
        const owner = company.users?.[0] || null;
        const reason = aggregateReason(seqs);

        // Destinatarios únicos
        const recipients = new Set();
        if (owner?.email) recipients.add(owner.email);
        if (company.email) recipients.add(company.email);

        if (recipients.size === 0) {
            logger.warn(
                `[JOB:${JOB_NAME}] sin destinatarios`,
                { companyId, name: company.name }
            );
            continue;
        }

        for (const to of recipients) {
            try {
                await notifications.sendSequencesAlert({
                    to,
                    bcc: notifyBcc || undefined,
                    companyName: company.name,
                    rnc: company.rnc,
                    ownerName: owner?.firstName || null,
                    reason,
                    sequences: seqs
                });
                notified.push({ companyId, to, count: seqs.length, reason });
            } catch (err) {
                logger.error(
                    `[JOB:${JOB_NAME}] email send failed`,
                    { companyId, to, error: err.message }
                );
            }
        }

        affected++;
    }

    // 4. Audit
    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'sequence',
            alertWindowDays: ALERT_WINDOW_DAYS,
            lowStockAbsolute: LOW_STOCK_ABSOLUTE,
            lowStockPercentage: LOW_STOCK_PERCENTAGE
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { affected, notified: notified.length });

    return {
        affected,
        entity: 'sequence',
        notified: notified.length
    };
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runSequencesHealthCheck);
module.exports._raw = runSequencesHealthCheck;
module.exports.JOB_NAME = JOB_NAME;
module.exports.ALERT_WINDOW_DAYS = ALERT_WINDOW_DAYS;
module.exports.LOW_STOCK_ABSOLUTE = LOW_STOCK_ABSOLUTE;
module.exports.LOW_STOCK_PERCENTAGE = LOW_STOCK_PERCENTAGE;
module.exports.KEY_DAYS = KEY_DAYS;
module.exports.classifySequence = classifySequence;