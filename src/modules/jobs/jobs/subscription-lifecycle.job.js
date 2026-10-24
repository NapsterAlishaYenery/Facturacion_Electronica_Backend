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

// Días de gracia para pagar desde el inicio del nuevo período (renovaciones)
const PAYMENT_DUE_DAYS = 10;

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

// ------------------------------------------------------------
// Notificar al cliente + alerta interna cuando se crea un
// pago pendiente. Fire-and-forget.
// ------------------------------------------------------------
async function notifyPaymentPending({ sub, plan, periodStart, periodEnd }) {
    const company = sub.company;
    if (!company) return;

    const owner = company.users?.[0] || null;
    const notifyBcc = notificationsConfig.alerts.registrationNotifyEmail || undefined;
    const paymentDueAt = new Date(periodStart.getTime() + PAYMENT_DUE_DAYS * DAY_MS);

    // 1. Destinatarios del correo al cliente
    const recipients = new Set();
    if (owner?.email) recipients.add(owner.email);
    if (company.email) recipients.add(company.email);

    // 2. Correo al cliente (uno por destinatario único)
    for (const to of recipients) {
        try {
            await notifications.sendPaymentPending({
                to,
                bcc: notifyBcc,
                companyName: company.name,
                rnc: company.rnc,
                ownerName: owner?.firstName || null,
                planName: plan.name,
                amount: plan.priceDop,
                currency: 'DOP',
                periodStart,
                periodEnd,
                paymentDueAt
            });
        } catch (err) {
            logger.error(
                `[JOB:${JOB_NAME}] payment pending email failed`,
                { subscriptionId: sub.id, to, error: err.message }
            );
        }
    }

    // 3. Alerta interna a Expedinap
    if (notifyBcc) {
        try {
            await notifications.sendPaymentPendingAlert({
                to: notifyBcc,
                company: {
                    id: company.id,
                    name: company.name,
                    rnc: company.rnc,
                    email: company.email
                },
                owner: owner ? {
                    firstName: owner.firstName,
                    email: owner.email
                } : null,
                plan: { name: plan.name },
                amount: plan.priceDop,
                currency: 'DOP',
                periodStart,
                periodEnd,
                paymentDueAt
            });
        } catch (err) {
            logger.error(
                `[JOB:${JOB_NAME}] payment pending alert failed`,
                { subscriptionId: sub.id, error: err.message }
            );
        }
    }
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
            {
                model: Company,
                as: 'company',
                required: true,
                attributes: ['id', 'name', 'rnc', 'email'],
                include: [{
                    model: User,
                    as: 'users',
                    where: { role: 'company_admin', isActive: true },
                    required: false,
                    attributes: ['id', 'email', 'firstName']
                }]
            }
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

            // Notificar al cliente + alerta interna a Expedinap
            // fire-and-forget (dentro del for, no bloquea al siguiente)
            notifyPaymentPending({
                sub,
                plan,
                periodStart,
                periodEnd
            }).catch(err => {
                logger.error(
                    `[JOB:${JOB_NAME}] payment pending notification failed`,
                    { subscriptionId: sub.id, error: err.message }
                );
            });

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
// FASE 3 — Convertir trials expirados a plan free
//
// Cuando un trial expira (trialEndsAt <= now y status = 'trial'),
// se cambia automáticamente al plan 'free' con status 'active'.
// El cliente sigue operando sin interrupciones.
// ============================================================
async function convertExpiredTrialsToFree(now) {
    // 1. Buscar el plan free
    const freePlan = await Plan.findOne({
        where: { code: 'free', isActive: true }
    });

    if (!freePlan) {
        logger.warn(`[JOB:${JOB_NAME}] plan 'free' no encontrado, saltando conversión`);
        return { converted: 0, errors: 0 };
    }

    // 2. Buscar trials expirados
    const expiredTrials = await Subscription.findAll({
        where: {
            status: 'trial',
            trialEndsAt: { [Op.ne]: null, [Op.lte]: now }
        },
        include: [
            { model: Plan, as: 'plan', required: false },
            {
                model: Company,
                as: 'company',
                required: true,
                attributes: ['id', 'name', 'rnc', 'email'],
                include: [{
                    model: User,
                    as: 'users',
                    where: { role: 'company_admin', isActive: true },
                    required: false,
                    attributes: ['id', 'email', 'firstName']
                }]
            }
        ]
    });

    const details = { converted: 0, errors: 0 };

    for (const sub of expiredTrials) {
        try {
            await sub.update({
                planId: freePlan.id,
                status: 'active',
                trialEndsAt: null,
                startsAt: now,
                currentPeriodStart: now,
                currentPeriodEnd: null,  // plan free no expira
                invoicesUsedThisMonth: 0
            });

            details.converted++;

            // Audit log
            await AuditLog.create({
                companyId: sub.companyId,
                userId: null,  // automático, sin usuario
                action: 'subscription.trial_converted_to_free',
                entity: 'subscription',
                entityId: sub.id,
                before: {
                    planCode: sub.plan?.code || null,
                    status: 'trial'
                },
                after: {
                    planCode: 'free',
                    status: 'active'
                },
                ip: null,
                userAgent: null
            });

            // Notificar al cliente (fire-and-forget)
            const company = sub.company;
            const owner = company?.users?.[0];
            const recipients = new Set();
            if (owner?.email) recipients.add(owner.email);
            if (company?.email) recipients.add(company.email);

            // TODO: template 'trial-converted-to-free' (post-MVP)
            // Por ahora, solo log
            logger.info(
                `[JOB:${JOB_NAME}] trial convertido a free`,
                {
                    subscriptionId: sub.id,
                    companyId: sub.companyId,
                    recipients: [...recipients]
                }
            );

        } catch (err) {
            logger.error(
                `[JOB:${JOB_NAME}] conversión a free falló`,
                { subscriptionId: sub.id, error: err.message }
            );
            details.errors++;
        }
    }

    return details;
}

// ============================================================
// FASE 4 — Convertir cancelled expirados al plan free
// Si un cliente canceló y el período terminó (currentPeriodEnd <= now),
// se baja automáticamente al plan free con status active.
// ============================================================
async function convertExpiredCancelledToFree(now) {
    const freePlan = await Plan.findOne({
        where: { code: 'free', isActive: true }
    });

    if (!freePlan) {
        logger.warn(`[JOB:${JOB_NAME}] plan 'free' no encontrado, saltando conversión`);
        return { converted: 0, errors: 0 };
    }

    const expiredCancelled = await Subscription.findAll({
        where: {
            status: 'cancelled',
            currentPeriodEnd: { [Op.ne]: null, [Op.lte]: now }
        },
        include: [
            { model: Plan, as: 'plan', required: false },
            {
                model: Company,
                as: 'company',
                required: true,
                attributes: ['id', 'name', 'rnc', 'email'],
                include: [{
                    model: User,
                    as: 'users',
                    where: { role: 'company_admin', isActive: true },
                    required: false,
                    attributes: ['id', 'email', 'firstName']
                }]
            }
        ]
    });

    const details = { converted: 0, errors: 0 };

    for (const sub of expiredCancelled) {
        try {
            await sub.update({
                planId: freePlan.id,
                status: 'active',
                cancelledAt: null,
                endsAt: null,
                currentPeriodStart: now,
                currentPeriodEnd: null,
                invoicesUsedThisMonth: 0
            });

            details.converted++;

            await AuditLog.create({
                companyId: sub.companyId,
                userId: null,
                action: 'subscription.cancelled_converted_to_free',
                entity: 'subscription',
                entityId: sub.id,
                before: {
                    planCode: sub.plan?.code || null,
                    status: 'cancelled'
                },
                after: {
                    planCode: 'free',
                    status: 'active'
                },
                ip: null,
                userAgent: null
            });

            logger.info(
                `[JOB:${JOB_NAME}] cancelled convertido a free`,
                { subscriptionId: sub.id, companyId: sub.companyId }
            );

        } catch (err) {
            logger.error(
                `[JOB:${JOB_NAME}] conversión cancelled→free falló`,
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

    const expiring = await notifyExpiringSoon(now);
    const renewals = await renewExpiredPeriods(now);
    const trialConversions = await convertExpiredTrialsToFree(now);
    const cancelledConversions = await convertExpiredCancelledToFree(now);

    const totalAffected =
        expiring.affected +
        renewals.renewed +
        trialConversions.converted +
        cancelledConversions.converted;

    // Audit
    if (totalAffected > 0) {
        await recordJobAudit(JOB_NAME, totalAffected, {
            entity: 'subscription',
            expiringNotified: expiring.affected,
            renewed: renewals.renewed,
            paymentsCreated: renewals.paymentsCreated,
            trialsConverted: trialConversions.converted,
            cancelledConverted: cancelledConversions.converted,
            errors: renewals.errors + trialConversions.errors + cancelledConversions.errors
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, {
        affected: totalAffected,
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        renewed: renewals.renewed,
        paymentsCreated: renewals.paymentsCreated,
        trialsConverted: trialConversions.converted,
        cancelledConverted: cancelledConversions.converted,
        errors: renewals.errors + trialConversions.errors + cancelledConversions.errors
    });

    return {
        affected: totalAffected,
        entity: 'subscription',
        expiringNotified: expiring.affected,
        notifiedEmails: expiring.notified.length,
        renewed: renewals.renewed,
        paymentsCreated: renewals.paymentsCreated,
        trialsConverted: trialConversions.converted,
        cancelledConverted: cancelledConversions.converted,
        errors: renewals.errors + trialConversions.errors + cancelledConversions.errors
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
module.exports.PAYMENT_DUE_DAYS = PAYMENT_DUE_DAYS;