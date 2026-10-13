// ============================================================
// Job: membership-invoice-reconciliation
//
// Busca pagos 'paid' que no lograron generar su factura de
// membresía y reintenta crearla. Si un pago acumula N intentos
// fallidos, alerta a Expedinap y deja de intentar.
//
// Corre cada 30 minutos.
//
// Contexto:
//   - registerPayment (subscriptions.service.js) intenta generar
//     la factura al registrar un pago 'paid'.
//   - Si falla, el pago queda con invoice_id = NULL.
//   - Este job barre periódicamente esos pagos y reintenta.
//   - createMembershipInvoice tiene guard de idempotencia:
//     si la factura ya se creó, devuelve la existente sin efectos.
//
// Solo procesa pagos de los últimos 7 días. No barre histórico
// viejo (esos casos se resuelven manualmente).
//
// Se monta desde jobs.scheduler.js.
// ============================================================

const { Op } = require('sequelize');
const {
    SubscriptionPayment,
    Subscription,
    Plan,
    Company
} = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');
const notifications = require('../../notifications');
const notificationsConfig = require('../../../config/notifications');

const JOB_NAME = 'membership-invoice-reconciliation';

// ------------------------------------------------------------
// Parámetros del job
// ------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const WINDOW_DAYS = 7;
const BATCH_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Helper puro: ¿este pago debe procesarse?
// Devuelve true si cumple TODAS las condiciones.
// ------------------------------------------------------------
function shouldProcess(payment, now = new Date()) {
    if (!payment) return false;
    if (payment.status !== 'paid') return false;
    if (payment.invoiceId) return false;
    if (Number(payment.amount) <= 0) return false;
    if (Number(payment.invoiceGenerationAttempts) >= MAX_ATTEMPTS) return false;

    if (payment.paidAt) {
        const age = now.getTime() - new Date(payment.paidAt).getTime();
        if (age > WINDOW_DAYS * DAY_MS) return false;
    }

    return true;
}

// ------------------------------------------------------------
// Helper puro: ¿ya alcanzó el máximo de intentos?
// ------------------------------------------------------------
function hasReachedMaxAttempts(payment) {
    return Number(payment?.invoiceGenerationAttempts || 0) >= MAX_ATTEMPTS;
}

// ------------------------------------------------------------
// Helper puro: construir el update de un intento fallido
// ------------------------------------------------------------
function buildAttemptUpdate(payment, error) {
    return {
        invoiceGenerationAttempts: Number(payment.invoiceGenerationAttempts || 0) + 1,
        lastInvoiceAttemptAt: new Date()
    };
}

// ------------------------------------------------------------
// Helper puro: shape del audit meta
// ------------------------------------------------------------
function formatAuditMeta({ regenerated, failed, exhausted, skipped }) {
    return {
        entity: 'subscription_payment',
        regenerated,
        failed,
        exhausted,
        skipped,
        maxAttempts: MAX_ATTEMPTS,
        windowDays: WINDOW_DAYS
    };
}

// ------------------------------------------------------------
// Cargar Expedinap para excluir sus pagos (no se factura a sí mismo)
// ------------------------------------------------------------
async function getSystemOwnerId() {
    const owner = await Company.findOne({
        where: { isSystemOwner: true },
        attributes: ['id']
    });
    return owner?.id || null;
}

// ------------------------------------------------------------
// Lógica principal
// ------------------------------------------------------------
async function runMembershipInvoiceReconciliation() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

    // 1. Cargar system owner para excluirlo
    const systemOwnerId = await getSystemOwnerId();

    // 2. Buscar pagos candidatos
    const where = {
        status: 'paid',
        invoiceId: null,
        amount: { [Op.gt]: 0 },
        paidAt: { [Op.gte]: cutoff },
        invoiceGenerationAttempts: { [Op.lt]: MAX_ATTEMPTS }
    };

    if (systemOwnerId) {
        where.companyId = { [Op.ne]: systemOwnerId };
    }

    const payments = await SubscriptionPayment.findAll({
        where,
        include: [
            {
                model: Subscription,
                as: 'subscription',
                required: true,
                attributes: ['id', 'planId', 'companyId'],
                include: [{
                    model: Plan,
                    as: 'plan',
                    required: false,
                    attributes: ['id', 'code', 'name']
                }]
            },
            {
                model: Company,
                as: 'company',
                required: true,
                attributes: ['id', 'rnc', 'name', 'email']
            }
        ],
        order: [['paidAt', 'ASC']],
        limit: BATCH_LIMIT
    });

    // 3. Contadores
    let regenerated = 0;
    let failed = 0;
    let exhausted = 0;
    let skipped = 0;

    // 4. Procesar cada pago
    for (const payment of payments) {
        // 4.1. Revalidar con el helper puro
        if (!shouldProcess(payment, now)) {
            skipped++;
            continue;
        }

        // 4.2. Validar que tengamos planId y empresa
        const planId = payment.subscription?.planId;
        if (!planId || !payment.company) {
            logger.warn(`[JOB:${JOB_NAME}] pago sin plan o empresa`, {
                paymentId: payment.id
            });
            skipped++;
            continue;
        }

        // 4.3. Intentar generar la factura
        try {
            const internalBilling = require('../../internal-billing/internalBilling.service');

            await internalBilling.createMembershipInvoice({
                clientCompanyId: payment.companyId,
                planId,
                paymentId: payment.id,
                amount: payment.amount,
                periodStart: payment.periodStart,
                periodEnd: payment.periodEnd,
                reqUser: null,       // ← sin usuario: es un job
                reqInfo: {}          // ← sin IP/UA: es un job
            });

            // 4.4. Éxito → resetear intentos (aunque el guard de
            //      idempotencia ya cubre, por consistencia)
            if (payment.invoiceGenerationAttempts > 0) {
                await payment.update({ invoiceGenerationAttempts: 0 });
            }

            regenerated++;

            logger.info(`[JOB:${JOB_NAME}] factura regenerada`, {
                paymentId: payment.id,
                companyId: payment.companyId
            });

        } catch (err) {
            // 4.5. Fallo → incrementar intentos
            const update = buildAttemptUpdate(payment, err);
            await payment.update(update);

            const newAttempts = update.invoiceGenerationAttempts;

            if (hasReachedMaxAttempts({ invoiceGenerationAttempts: newAttempts })) {
                exhausted++;

                logger.error(`[JOB:${JOB_NAME}] agotados intentos`, {
                    paymentId: payment.id,
                    attempts: newAttempts,
                    error: err.message
                });

                // Alertar a Expedinap (fire-and-forget)
                notifyExhausted(payment, newAttempts, err.message).catch(notifyErr => {
                    logger.error(`[JOB:${JOB_NAME}] alert email failed`, {
                        paymentId: payment.id,
                        error: notifyErr.message
                    });
                });
            } else {
                failed++;

                logger.warn(`[JOB:${JOB_NAME}] intento fallido`, {
                    paymentId: payment.id,
                    attempts: newAttempts,
                    error: err.message
                });
            }
        }
    }

    // 5. Audit
    const affected = regenerated + failed + exhausted;
    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, formatAuditMeta({
            regenerated,
            failed,
            exhausted,
            skipped
        }));
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, {
        affected,
        regenerated,
        failed,
        exhausted,
        skipped,
        total: payments.length
    });

    return {
        affected,
        entity: 'subscription_payment',
        regenerated,
        failed,
        exhausted,
        skipped,
        total: payments.length
    };
}

// ------------------------------------------------------------
// Notificar a Expedinap cuando se agotan los intentos.
// Fire-and-forget.
// ------------------------------------------------------------
async function notifyExhausted(payment, attempts, lastError) {
    const to = notificationsConfig.alerts.registrationNotifyEmail;
    if (!to) {
        logger.warn(`[JOB:${JOB_NAME}] sin REGISTRATION_NOTIFY_EMAIL, no se puede alertar`);
        return;
    }

    await notifications.sendMembershipInvoiceFailed({
        to,
        payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            paidAt: payment.paidAt,
            periodStart: payment.periodStart,
            periodEnd: payment.periodEnd,
            invoiceGenerationAttempts: attempts,
            lastInvoiceAttemptAt: new Date()
        },
        company: payment.company
            ? {
                id: payment.company.id,
                name: payment.company.name,
                rnc: payment.company.rnc,
                email: payment.company.email
            }
            : { id: payment.companyId, name: 'Empresa desconocida', rnc: null },
        attempts,
        lastError
    });
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runMembershipInvoiceReconciliation);
module.exports._raw = runMembershipInvoiceReconciliation;
module.exports.JOB_NAME = JOB_NAME;
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS;
module.exports.WINDOW_DAYS = WINDOW_DAYS;
module.exports.BATCH_LIMIT = BATCH_LIMIT;

// Helpers puros (para tests)
module.exports.shouldProcess = shouldProcess;
module.exports.hasReachedMaxAttempts = hasReachedMaxAttempts;
module.exports.buildAttemptUpdate = buildAttemptUpdate;
module.exports.formatAuditMeta = formatAuditMeta;