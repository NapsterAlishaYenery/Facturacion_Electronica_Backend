// ============================================================
// Job: subscription-lifecycle
//
// Gestiona el ciclo de vida de las suscripciones (transiciones
// de estado) y notifica a los dueños antes de que venzan.
//
// Corre diario a las 00:00 (timezone RD).
//
// Fase 6 Step 6.9: agrega notificaciones preventivas.
//
// FASE 1 (preventiva): notificar suscripciones que vencen en
//   días clave (15, 7, 3, 1) — antes de la transición.
//
// FASE 2 (transiciones): las mismas 3 reglas de siempre.
//   trial     + trial_ends_at <= now()                    → past_due
//   past_due  + (trial_ends_at o current_period_end) + 3d → expired
//   active    + current_period_end <= now()               → past_due
//
// Estados que NO toca:
//   - cancelled (decisión manual del usuario)
//   - expired   (esperando pago)
//
// La notificación de cambio de estado (past_due, expired) queda
// pendiente para un step posterior.
// ============================================================

const { Op } = require('sequelize');
const { Subscription, Company, User, Plan } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');

const JOB_NAME = 'subscription-lifecycle';
const GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Ventana preventiva y días clave
// ------------------------------------------------------------
const ALERT_WINDOW_DAYS = 15;
const KEY_DAYS = new Set([15, 7, 3, 1]);

// ------------------------------------------------------------
// Días completos restantes (mismo helper que otros jobs)
// ------------------------------------------------------------
function daysUntil(targetDate, now = new Date()) {
    const diff = new Date(targetDate).getTime() - now.getTime();
    return diff >= 0
        ? Math.floor(diff / DAY_MS)
        : Math.ceil(diff / DAY_MS);
}

// ------------------------------------------------------------
// Calcular la fecha de vencimiento efectiva según el status
// ------------------------------------------------------------
function getEffectiveExpiry(sub) {
    if (sub.status === 'trial') return sub.trialEndsAt;
    if (sub.status === 'active') return sub.currentPeriodEnd;
    return null;
}

// ============================================================
// FASE 1 — Notificar suscripciones próximas a vencer
// ============================================================
async function notifyExpiringSoon(now) {
    const cutoff = new Date(now.getTime() + ALERT_WINDOW_DAYS * DAY_MS);

    // 1. Buscar suscripciones en trial o active cuya fecha efectiva
    //    cae dentro de la ventana preventiva (no incluye las ya vencidas).
    const subs = await Subscription.findAll({
        where: {
            status: ['trial', 'active'],
            [Op.or]: [
                {
                    status: 'trial',
                    trialEndsAt: { [Op.ne]: null, [Op.gt]: now, [Op.lte]: cutoff }
                },
                {
                    status: 'active',
                    currentPeriodEnd: { [Op.ne]: null, [Op.gt]: now, [Op.lte]: cutoff }
                }
            ]
        },
        include: [
            {
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
            },
            {
                model: Plan,
                as: 'plan',
                required: false,
                attributes: ['id', 'code', 'name']
            }
        ]
    });

    // 2. Filtrar por días clave y notificar
    let affected = 0;
    const notified = [];
    const notifyBcc = notificationsConfig.alerts.registrationNotifyEmail;

    for (const sub of subs) {
        const expiresAt = getEffectiveExpiry(sub);
        if (!expiresAt) continue;

        const daysLeft = daysUntil(expiresAt, now);
        if (!KEY_DAYS.has(daysLeft)) continue;

        const company = sub.company;
        const owner = company.users?.[0] || null;

        // Destinatarios únicos
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

        for (const to of recipients) {
            try {
                await notifications.sendSubscriptionExpiring({
                    to,
                    bcc: notifyBcc || undefined,
                    companyName: company.name,
                    rnc: company.rnc,
                    ownerName: owner?.firstName || null,
                    status: sub.status,
                    planName: sub.plan?.name || null,
                    expiresAt,
                    daysLeft
                });
                notified.push({
                    subscriptionId: sub.id,
                    companyId: company.id,
                    to,
                    daysLeft
                });
            } catch (err) {
                logger.error(
                    `[JOB:${JOB_NAME}] expiring email failed`,
                    { subscriptionId: sub.id, to, error: err.message }
                );
            }
        }

        affected++;
    }

    return { affected, notified };
}

// ============================================================
// FASE 2 — Transiciones de estado (lógica existente)
// ============================================================
async function applyStateTransitions(now) {
    const graceCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);
    const details = {
        trialToPastDue: 0,
        pastDueToExpired: 0,
        activeToPastDue: 0
    };

    // 1. trial → past_due
    const [trialToPastDue] = await Subscription.update(
        { status: 'past_due' },
        {
            where: {
                status: 'trial',
                trialEndsAt: { [Op.lte]: now, [Op.ne]: null }
            }
        }
    );
    details.trialToPastDue = trialToPastDue;

    // 2. past_due → expired (pasaron los 3 días de gracia)
    const [pastDueToExpired] = await Subscription.update(
        { status: 'expired' },
        {
            where: {
                status: 'past_due',
                [Op.or]: [
                    { trialEndsAt: { [Op.lte]: graceCutoff, [Op.ne]: null } },
                    { currentPeriodEnd: { [Op.lte]: graceCutoff, [Op.ne]: null } }
                ]
            }
        }
    );
    details.pastDueToExpired = pastDueToExpired;

    // 3. active → past_due
    const [activeToPastDue] = await Subscription.update(
        { status: 'past_due' },
        {
            where: {
                status: 'active',
                currentPeriodEnd: { [Op.lte]: now, [Op.ne]: null }
            }
        }
    );
    details.activeToPastDue = activeToPastDue;

    return details;
}

// ============================================================
// Lógica principal
// ============================================================
async function runSubscriptionLifecycle() {
    const now = new Date();

    // ══════════════════════════════════════════════════════════
    // FASE 1 — Notificar antes de vencer (preventivo)
    // ══════════════════════════════════════════════════════════
    const expiring = await notifyExpiringSoon(now);

    // ══════════════════════════════════════════════════════════
    // FASE 2 — Aplicar transiciones de estado
    // ══════════════════════════════════════════════════════════
    const transitions = await applyStateTransitions(now);

    const totalAffected =
        expiring.affected +
        transitions.trialToPastDue +
        transitions.pastDueToExpired +
        transitions.activeToPastDue;

    // ══════════════════════════════════════════════════════════
    // FASE 3 — Audit
    // ══════════════════════════════════════════════════════════
    if (totalAffected > 0) {
        await recordJobAudit(JOB_NAME, totalAffected, {
            entity: 'subscription',
            expiringNotified: expiring.affected,
            ...transitions
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, {
        affected: totalAffected,
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        ...transitions
    });

    return {
        affected: totalAffected,
        entity: 'subscription',
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        ...transitions
    };
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runSubscriptionLifecycle);
module.exports._raw = runSubscriptionLifecycle;
module.exports.JOB_NAME = JOB_NAME;
module.exports.GRACE_DAYS = GRACE_DAYS;
module.exports.ALERT_WINDOW_DAYS = ALERT_WINDOW_DAYS;
module.exports.KEY_DAYS = KEY_DAYS;