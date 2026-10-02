// ============================================================
// Job: alert-expiring-certs
//
// Detecta empresas cuyo certificado digital (.p12) expira en
// los próximos 30 días. Solo loguea (read-only, no modifica BD).
//
// En Fase 6 este job llamará a notifications.sendEmail() para
// avisar al owner de cada empresa.
//
// Corre diario a las 06:00 (timezone RD).
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.4.
// ============================================================

const { Op } = require('sequelize');
const { Company } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'alert-expiring-certs';
const ALERT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

async function runAlertExpiringCerts() {
    const now = new Date();
    const cutoff = new Date(now.getTime() + ALERT_WINDOW_DAYS * DAY_MS);

    const companies = await Company.findAll({
        where: {
            isActive: true,
            certificateExpiresAt: {
                [Op.ne]: null,
                [Op.lte]: cutoff
            }
        },
        attributes: ['id', 'rnc', 'name', 'email', 'certificateExpiresAt'],
        order: [['certificateExpiresAt', 'ASC']]
    });

    // Log detallado por empresa (Fase 6: reemplazar por email)
    for (const c of companies) {
        const daysLeft = Math.ceil(
            (new Date(c.certificateExpiresAt).getTime() - now.getTime()) / DAY_MS
        );
        const expired = daysLeft <= 0;

        logger.warn(
            `[JOB:${JOB_NAME}] ${expired ? 'certificado VENCIDO' : 'certificado por vencer'}`,
            {
                companyId: c.id,
                rnc: c.rnc,
                name: c.name,
                email: c.email,
                expiresAt: c.certificateExpiresAt,
                daysLeft
            }
        );
    }

    const affected = companies.length;

    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'company',
            alertWindowDays: ALERT_WINDOW_DAYS,
            companyIds: companies.map(c => c.id)
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { affected });

    return {
        affected,
        entity: 'company',
        companies: companies.map(c => ({
            id: c.id,
            rnc: c.rnc,
            name: c.name,
            expiresAt: c.certificateExpiresAt
        }))
    };
}

module.exports = withErrorHandling(JOB_NAME, runAlertExpiringCerts);
module.exports._raw = runAlertExpiringCerts;
module.exports.JOB_NAME = JOB_NAME;
module.exports.ALERT_WINDOW_DAYS = ALERT_WINDOW_DAYS;