// ============================================================
// Job: alert-expiring-certs
//
// Detecta empresas cuyo certificado digital (.p12) expira en
// los próximos 30 días y envía un correo de aviso al dueño y
// a la empresa (bcc a Expedinap para seguimiento comercial).
//
// Corre diario a las 06:00 (timezone RD).
//
// Fase 6 Step 6.7: integrado con el módulo de notificaciones.
// Se envía solo en días clave (30, 15, 7, 3, 1, 0, -1, -7) para
// evitar spam diario durante toda la ventana de alerta.
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.4.
// ============================================================

const { Op } = require('sequelize');
const { Company, User } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');

const JOB_NAME = 'alert-expiring-certs';
const ALERT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Días clave para disparar el aviso (evita spam diario)
// 30, 15, 7, 3, 1 antes de vencer
// 0 = vence hoy, -1 = venció ayer, -7 = venció hace una semana
// ------------------------------------------------------------
const KEY_DAYS = new Set([30, 15, 7, 3, 1, 0, -1, -7]);

// ------------------------------------------------------------
// Calcular días restantes (puede ser negativo si ya venció)
// ------------------------------------------------------------
function daysUntil(targetDate, now = new Date()) {
    const diff = new Date(targetDate).getTime() - now.getTime();
    return diff >= 0
        ? Math.floor(diff / DAY_MS)
        : Math.ceil(diff / DAY_MS);
}

// ------------------------------------------------------------
// Lógica principal
// ------------------------------------------------------------
async function runAlertExpiringCerts() {
    const now = new Date();
    const cutoff = new Date(now.getTime() + ALERT_WINDOW_DAYS * DAY_MS);

    // 1. Buscar empresas con certificado próximo a vencer (o ya vencido)
    //    Incluye el company_admin activo para notificarle
    const companies = await Company.findAll({
        where: {
            isActive: true,
            certificateExpiresAt: {
                [Op.ne]: null,
                [Op.lte]: cutoff
            }
        },
        attributes: ['id', 'rnc', 'name', 'email', 'certificateExpiresAt'],
        include: [{
            model: User,
            as: 'users',
            where: { role: 'company_admin', isActive: true },
            required: false,               // LEFT JOIN
            attributes: ['id', 'email', 'firstName']
        }],
        order: [['certificateExpiresAt', 'ASC']]
    });

    // 2. Filtrar solo días clave y notificar
    let affected = 0;
    const notified = [];
    const notifyBcc = notificationsConfig.alerts.registrationNotifyEmail;

    for (const company of companies) {
        const daysLeft = daysUntil(company.certificateExpiresAt, now);

        // 2a. Saltar si no es día clave
        if (!KEY_DAYS.has(daysLeft)) {
            logger.debug(
                `[JOB:${JOB_NAME}] skip (no key day)`,
                { companyId: company.id, daysLeft }
            );
            continue;
        }

        const expired = daysLeft <= 0;
        const owner = company.users?.[0] || null;

        // 2b. Destinatarios: owner + company.email (únicos)
        const recipients = new Set();
        if (owner?.email) recipients.add(owner.email);
        if (company.email) recipients.add(company.email);

        if (recipients.size === 0) {
            logger.warn(
                `[JOB:${JOB_NAME}] sin destinatarios`,
                { companyId: company.id, name: company.name }
            );
            continue;
        }

        // 2c. Enviar a cada destinatario (con try/catch individual)
        for (const to of recipients) {
            try {
                await notifications.sendCertificateExpiring({
                    to,
                    bcc: notifyBcc || undefined,
                    companyName: company.name,
                    rnc: company.rnc,
                    ownerName: owner?.firstName || null,
                    expiresAt: company.certificateExpiresAt,
                    daysLeft,
                    expired
                });
                notified.push({ companyId: company.id, to, daysLeft });
            } catch (err) {
                logger.error(
                    `[JOB:${JOB_NAME}] email send failed`,
                    { companyId: company.id, to, error: err.message }
                );
            }
        }

        affected++;
    }

    // 3. Audit log (solo si affected > 0)
    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'company',
            alertWindowDays: ALERT_WINDOW_DAYS,
            keyDays: Array.from(KEY_DAYS),
            companyIds: companies.map(c => c.id)
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { affected, notified: notified.length });

    return {
        affected,
        entity: 'company',
        notified: notified.length,
        companies: notified.map(n => ({
            companyId: n.companyId,
            to: n.to,
            daysLeft: n.daysLeft
        }))
    };
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runAlertExpiringCerts);
module.exports._raw = runAlertExpiringCerts;
module.exports.JOB_NAME = JOB_NAME;
module.exports.ALERT_WINDOW_DAYS = ALERT_WINDOW_DAYS;
module.exports.KEY_DAYS = KEY_DAYS;