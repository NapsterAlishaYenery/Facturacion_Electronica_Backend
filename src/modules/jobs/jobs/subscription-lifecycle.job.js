// ============================================================
// Job: subscription-lifecycle
//
// Corre diario a las 00:00 (timezone RD).
//
// FASE 1 (preventiva): notificar suscripciones que vencen en
//   días clave (15, 7, 3, 1) — antes de la transición.
//
// FASE 2 (renovación): al vencer currentPeriodEnd de una
//   suscripción active, se crea un SubscriptionPayment pending
//   para el próximo período y se avanza el período. El status
//   NO se toca: el bloqueo es decisión del admin.
//
// Estados que NO toca: trial, past_due, cancelled, expired.
// Todos ellos los gestiona el admin manualmente via
// PATCH /api/subscriptions/:id (Fase 7 Step 7.12).
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../../config/database');
const {
    Subscription, Company, User, Plan, SubscriptionPayment, AuditLog
} = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');

const JOB_NAME = 'subscription-lifecycle';
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 30;

// ------------------------------------------------------------
// Ventana preventiva y días clave
// ------------------------------------------------------------
const ALERT_WINDOW_DAYS = 15;
const KEY_DAYS = new Set([15, 7, 3, 1]);

// ------------------------------------------------------------
// Días completos restantes
// ------------------------------------------------------------
function daysUntil(targetDate, now = new Date()) {
    const diff = new Date(targetDate).getTime() - now.getTime();
    return diff >= 0
        ? Math.floor(diff / DAY_MS)
        : Math.ceil(diff / DAY_MS);
}

// ------------------------------------------------------------
// Vencimiento efectivo según status
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
// FASE 2 — Renovar períodos vencidos (sin bloquear)
//
// Para cada suscripción active con currentPeriodEnd <= now:
//   1. Crea un SubscriptionPayment pending para el próximo período.
//   2. Avanza currentPeriodStart / currentPeriodEnd y resetea
//      invoicesUsedThisMonth.
//   3. NO cambia el status. El bloqueo lo decide el admin.
// ============================================================
async function renewExpiredPeriods(now) {
    const expired = await Subscription.findAll({
        where: {
            status: 'active',
            currentPeriodEnd: { [Op.ne]: null, [Op.lte]: now }
        },
        include: [
            { model: Plan, as: 'plan', required: true },
            { model: Company, as: 'company', required: true, attributes: ['id', 'name'] }
        ]
    });

    const details = {
        renewed: 0,
        paymentsCreated: 0,
        errors: 0
    };

    for (const sub of expired) {
        const plan = sub.plan;

        if (!plan) {
            logger.warn(`[JOB:${JOB_NAME}] sin plan`, { subscriptionId: sub.id });
            details.errors++;
            continue;
        }

        const periodStart = now;
        const periodEnd = new Date(now.getTime() + PERIOD_DAYS * DAY_MS);

        try {
            await sequelize.transaction(async (t) => {
                // 1. Crear pago pending
                await SubscriptionPayment.create({
                    subscriptionId: sub.id,
                    companyId: sub.companyId,
                    amount: plan.priceDop,
                    currency: 'DOP',
                    paymentMethod: null,
                    reference: null,
                    periodStart,
                    periodEnd,
                    status: 'pending',
                    paidAt: null,
                    notes: `Auto-renewal: ${plan.code}`
                }, { transaction: t });

                // 2. Avanzar período
                await sub.update({
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    invoicesUsedThisMonth: 0
                }, { transaction: t });
            });

            details.renewed++;
            details.paymentsCreated++;

        } catch (err) {
            logger.error(
                `[JOB:${JOB_NAME}] renew failed`,
                { subscriptionId: sub.id, error: err.message }
            );
            details.errors++;
        }
    }

    return details;
}

// ============================================================
// Lógica principal
// ============================================================
async function runSubscriptionLifecycle() {
    const now = new Date();

    // FASE 1 — Notificar antes de vencer
    const expiring = await notifyExpiringSoon(now);

    // FASE 2 — Renovar períodos vencidos (sin bloquear)
    const renewals = await renewExpiredPeriods(now);

    const totalAffected =
        expiring.affected +
        renewals.renewed;

    // FASE 3 — Audit
    if (totalAffected > 0) {
        await recordJobAudit(JOB_NAME, totalAffected, {
            entity: 'subscription',
            expiringNotified: expiring.affected,
            renewed: renewals.renewed,
            paymentsCreated: renewals.paymentsCreated,
            errors: renewals.errors
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, {
        affected: totalAffected,
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        renewed: renewals.renewed,
        paymentsCreated: renewals.paymentsCreated,
        errors: renewals.errors
    });

    return {
        affected: totalAffected,
        entity: 'subscription',
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        renewed: renewals.renewed,
        paymentsCreated: renewals.paymentsCreated,
        errors: renewals.errors
    };
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runSubscriptionLifecycle);
module.exports._raw = runSubscriptionLifecycle;
module.exports.JOB_NAME = JOB_NAME;
module.exports.ALERT_WINDOW_DAYS = ALERT_WINDOW_DAYS;
module.exports.KEY_DAYS = KEY_DAYS;
module.exports.PERIOD_DAYS = PERIOD_DAYS;