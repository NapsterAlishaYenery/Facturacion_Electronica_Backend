// ============================================================
// Job: retry-failed-sends
//
// Reintenta enviar a DGII facturas que quedaron en status='signed'
// con track_id NULL (nunca se enviaron o el envío murió antes de
// recibir track_id). Corre cada 30 minutos.
//
// ⚠️ Stub hasta Fase 8. El job detecta si dgii.sender.sendECF()
//    existe. Si no existe, hace log y sale limpiamente sin tocar
//    ninguna factura.
//
// Máximo 5 intentos por factura. Al superar: status='rejected'
// con dgii_response explicando el motivo.
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.5.
// ============================================================

const { Op } = require('sequelize');
const { Invoice } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'retry-failed-sends';
const MAX_ATTEMPTS = 5;
const MIN_AGE_MINUTES = 30;
const MINUTE_MS = 60 * 1000;

// ------------------------------------------------------------
// Carga el sender de DGII si existe (Fase 8).
// Si no existe, retorna null y el job no hace nada.
// ------------------------------------------------------------
function loadDgiiSender() {
    try {
        const sender = require('../../dgii/dgii.sender');
        if (typeof sender.sendECF !== 'function') return null;
        return sender;
    } catch (err) {
        // El módulo dgii.sender aún no existe (Fase 8).
        return null;
    }
}

async function runRetryFailedSends() {
    const dgiiSender = loadDgiiSender();

    if (!dgiiSender) {
        logger.debug(`[JOB:${JOB_NAME}] dgii.sender no disponible (Fase 8 pendiente), skip`);
        return {
            affected: 0,
            entity: 'invoice',
            reason: 'dgii.sender not implemented'
        };
    }

    const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * MINUTE_MS);

    const invoices = await Invoice.findAll({
        where: {
            status: 'signed',
            trackId: null,
            createdAt: { [Op.lt]: cutoff },
            sendAttempts: { [Op.lt]: MAX_ATTEMPTS }
        },
        order: [['createdAt', 'ASC']],
        limit: 50
    });

    let sent = 0;
    let failed = 0;
    let exhausted = 0;

    for (const inv of invoices) {
        try {
            const response = await dgiiSender.sendECF(inv);

            if (response && response.trackId) {
                await inv.update({
                    status: 'sent',
                    trackId: response.trackId,
                    dgiiResponse: response,
                    sendAttempts: inv.sendAttempts + 1
                });
                sent++;
            } else {
                await inv.update({
                    sendAttempts: inv.sendAttempts + 1,
                    dgiiResponse: response || { error: 'no trackId returned' }
                });
                failed++;
            }

        } catch (err) {
            const newAttempts = inv.sendAttempts + 1;

            if (newAttempts >= MAX_ATTEMPTS) {
                await inv.update({
                    status: 'rejected',
                    sendAttempts: newAttempts,
                    dgiiResponse: { error: err.message, attempts: newAttempts }
                });
                exhausted++;
            } else {
                await inv.update({
                    sendAttempts: newAttempts,
                    dgiiResponse: { error: err.message, attempts: newAttempts }
                });
                failed++;
            }
        }
    }

    const affected = sent + failed + exhausted;

    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'invoice',
            sent,
            failed,
            exhausted
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { sent, failed, exhausted });

    return {
        affected,
        entity: 'invoice',
        sent,
        failed,
        exhausted
    };
}

module.exports = withErrorHandling(JOB_NAME, runRetryFailedSends);
module.exports._raw = runRetryFailedSends;
module.exports.JOB_NAME = JOB_NAME;
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS;
module.exports.MIN_AGE_MINUTES = MIN_AGE_MINUTES;