// ============================================================
// Job: poll-pending-status
//
// Consulta a DGII el veredicto (accepted/rejected) de facturas
// que ya fueron enviadas (status='sent') y tienen track_id.
// Corre cada 15 minutos.
//
// ⚠️ Stub hasta Fase 8. Detecta si dgii.status.checkStatus() existe.
//    Si no existe, hace log y sale limpiamente.
//
// Estados posibles que devuelve DGII (según normativa):
//   - "pending"  → no cambia status (aún procesando)
//   - "accepted" → status = 'accepted'
//   - "rejected" → status = 'rejected'
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.6.
// ============================================================

const { Op } = require('sequelize');
const { Invoice, Company, User } = require('../../../models');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'poll-pending-status';
const MIN_AGE_MINUTES = 5;
const BATCH_LIMIT = 50;
const MINUTE_MS = 60 * 1000;

// ------------------------------------------------------------
// Carga el módulo dgii.status si existe (Fase 8).
// ------------------------------------------------------------
function loadDgiiStatus() {
    try {
        const status = require('../../dgii/dgii.status');
        if (typeof status.checkStatus !== 'function') return null;
        return status;
    } catch (err) {
        return null;
    }
}

// ------------------------------------------------------------
// Normaliza la respuesta de DGII a un status interno.
// Debe ser tolerante a variaciones de mayúsculas / español.
// ------------------------------------------------------------
function normalizeStatus(raw) {
    if (!raw) return 'pending';
    const s = String(raw).toLowerCase().trim();

    if (s.includes('aceptad') || s === 'accepted' || s === 'ok') return 'accepted';
    if (s.includes('rechaz') || s === 'rejected' || s === 'error') return 'rejected';

    return 'pending';
}

// ------------------------------------------------------------
// Enviar notificación a los destinatarios (owner + company + bcc)
// Fire-and-forget: no bloquea el loop.
// ------------------------------------------------------------
async function notifyInvoiceStatusChanged(invoice, status, response) {
    // 1. Cargar empresa + owner
    const company = await Company.findByPk(invoice.companyId, {
        attributes: ['id', 'rnc', 'name', 'email'],
        include: [{
            model: User,
            as: 'users',
            where: { role: 'company_admin', isActive: true },
            required: false,
            attributes: ['id', 'email', 'firstName']
        }]
    });

    if (!company) return;

    const owner = company.users?.[0] || null;
    const bcc = notificationsConfig.alerts.registrationNotifyEmail || undefined;

    // 2. Destinatarios únicos
    const recipients = new Set();
    if (owner?.email) recipients.add(owner.email);
    if (company.email) recipients.add(company.email);

    if (recipients.size === 0) return;

    // 3. Payload común
    const invoiceData = {
        id: invoice.id,
        ncf: invoice.ncf,
        type: invoice.type,
        total: invoice.total,
        issuedAt: invoice.issuedAt,
        createdAt: invoice.createdAt
    };
    const companyData = {
        id: company.id,
        rnc: company.rnc,
        name: company.name,
        email: company.email
    };

    // 4. Extraer motivo del rechazo si aplica
    const reason = status === 'rejected'
        ? (response?.motivo || response?.mensaje || response?.message || response?.error || null)
        : null;

    // 5. Enviar a cada destinatario
    for (const to of recipients) {
        try {
            if (status === 'accepted') {
                await notifications.sendInvoiceAccepted({
                    to,
                    bcc,
                    invoice: invoiceData,
                    company: companyData
                });
            } else if (status === 'rejected') {
                await notifications.sendInvoiceRejectedByDgii({
                    to,
                    bcc,
                    invoice: invoiceData,
                    company: companyData,
                    reason
                });
            }
        } catch (err) {
            logger.error(`[JOB:${JOB_NAME}] notification failed`, {
                invoiceId: invoice.id,
                to,
                error: err.message
            });
        }
    }
}

async function runPollPendingStatus() {
    const dgiiStatus = loadDgiiStatus();

    if (!dgiiStatus) {
        logger.debug(`[JOB:${JOB_NAME}] dgii.status no disponible (Fase 8 pendiente), skip`);
        return {
            affected: 0,
            entity: 'invoice',
            reason: 'dgii.status not implemented'
        };
    }

    const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * MINUTE_MS);

    const invoices = await Invoice.findAll({
        where: {
            status: 'sent',
            trackId: { [Op.ne]: null },
            createdAt: { [Op.lt]: cutoff }
        },
        order: [['createdAt', 'ASC']],
        limit: BATCH_LIMIT
    });

    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    let errors = 0;

    for (const inv of invoices) {
        try {
            const response = await dgiiStatus.checkStatus(inv.trackId);
            const newStatus = normalizeStatus(response?.estado || response?.status);

            if (newStatus === 'accepted') {
                await inv.update({
                    status: 'accepted',
                    dgiiResponse: response
                });
                accepted++;

                // Notificar al dueño (fire-and-forget)
                notifyInvoiceStatusChanged(inv, 'accepted', response).catch(err => {
                    logger.error(`[JOB:${JOB_NAME}] accept notification failed`, {
                        invoiceId: inv.id, error: err.message
                    });
                });
            } else if (newStatus === 'rejected') {
                await inv.update({
                    status: 'rejected',
                    dgiiResponse: response
                });
                rejected++;

                // Notificar al dueño (fire-and-forget)
                notifyInvoiceStatusChanged(inv, 'rejected', response).catch(err => {
                    logger.error(`[JOB:${JOB_NAME}] reject notification failed`, {
                        invoiceId: inv.id, error: err.message
                    });
                });
            } else {
                // pending: actualizamos dgii_response pero no el status
                await inv.update({ dgiiResponse: response });
                pending++;
            }

        } catch (err) {
            logger.warn(`[JOB:${JOB_NAME}] error consultando trackId ${inv.trackId}`, {
                error: err.message
            });
            errors++;
        }
    }

    const affected = accepted + rejected + pending + errors;

    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'invoice',
            accepted,
            rejected,
            pending,
            errors
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { accepted, rejected, pending, errors });

    return {
        affected,
        entity: 'invoice',
        accepted,
        rejected,
        pending,
        errors
    };
}

module.exports = withErrorHandling(JOB_NAME, runPollPendingStatus);
module.exports._raw = runPollPendingStatus;
module.exports.JOB_NAME = JOB_NAME;
module.exports.MIN_AGE_MINUTES = MIN_AGE_MINUTES;
module.exports.BATCH_LIMIT = BATCH_LIMIT;