// ============================================================
// Job: subscription-lifecycle
//
// Gestiona el ciclo de vida de las suscripciones (transiciones
// de estado). Corre diario a las 00:00 (timezone RD).
//
// NO resetea invoices_used_this_month. Eso lo hace el pago
// (SubscriptionPayment con status='paid') en el endpoint admin.
// Este job SOLO cambia estados según fechas vencidas.
//
// Transiciones que aplica:
//
//   trial     + trial_ends_at <= now()                    → past_due
//   past_due  + (trial_ends_at o current_period_end) + 3d → expired
//   active    + current_period_end <= now()               → past_due
//
// Estados que NO toca:
//   - cancelled (decisión manual del usuario)
//   - expired   (esperando pago)
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.2.
// ============================================================

const { Op } = require('sequelize');
const { Subscription } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'subscription-lifecycle';
const GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Lógica principal
// ============================================================

async function runSubscriptionLifecycle() {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);

    let affected = 0;
    const details = {
        trialToPastDue: 0,
        pastDueToExpired: 0,
        activeToPastDue: 0
    };

    // ----------------------------------------------------------
    // 1. trial → past_due  (el trial venció)
    // ----------------------------------------------------------
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
    affected += trialToPastDue;

    // ----------------------------------------------------------
    // 2. past_due → expired  (pasaron los días de gracia)
    //
    //    Caso A: venía de trial (usa trial_ends_at + gracia)
    //    Caso B: venía de active (usa current_period_end + gracia)
    //
    //    Usamos Op.or para cubrir ambos casos en una sola query.
    // ----------------------------------------------------------
    const [pastDueToExpired] = await Subscription.update(
        { status: 'expired' },
        {
            where: {
                status: 'past_due',
                [Op.or]: [
                    {
                        trialEndsAt: {
                            [Op.lte]: graceCutoff,
                            [Op.ne]: null
                        }
                    },
                    {
                        currentPeriodEnd: {
                            [Op.lte]: graceCutoff,
                            [Op.ne]: null
                        }
                    }
                ]
            }
        }
    );
    details.pastDueToExpired = pastDueToExpired;
    affected += pastDueToExpired;

    // ----------------------------------------------------------
    // 3. active → past_due  (el período venció sin renovar)
    // ----------------------------------------------------------
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
    affected += activeToPastDue;

    // ----------------------------------------------------------
    // 4. Audit log (solo si affected > 0)
    // ----------------------------------------------------------
    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'subscription',
            ...details
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, details);

    return {
        affected,
        entity: 'subscription',
        ...details
    };
}

// ============================================================
// Export: envuelto con withErrorHandling
//
// El scheduler llamará a este handler. withErrorHandling:
//   - mide duración
//   - captura errores (nunca relanza)
//   - loguea resultado estructurado
// ============================================================

module.exports = withErrorHandling(JOB_NAME, runSubscriptionLifecycle);

// Exportamos también la función cruda para tests que necesitan
// inspeccionar el retorno exacto sin el wrapper.
module.exports._raw = runSubscriptionLifecycle;
module.exports.JOB_NAME = JOB_NAME;
module.exports.GRACE_DAYS = GRACE_DAYS;