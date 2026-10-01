// ============================================================
// Utilidades compartidas para jobs programados (cron)
//
// Proporciona:
//   - logJobRun(jobName, result)         → log estructurado de cada corrida
//   - recordJobAudit(jobName, affected, meta) → inserta en audit_logs si affected > 0
//   - withErrorHandling(jobName, fn)     → wrapper try/catch + timing + log
//
// Patrón de uso (dentro de cada job individual):
//
//   const { withErrorHandling, recordJobAudit } = require('../jobs.utils');
//
//   async function runResetInvoicesMonthly() {
//       // ... lógica ...
//       return { affected: 42 };
//   }
//
//   module.exports = withErrorHandling(
//       'reset-invoices-monthly',
//       runResetInvoicesMonthly
//   );
//
// withErrorHandling NUNCA relanza errores: los loguea y retorna
// { status: 'failed', error }. Así un job roto jamás tumba el server
// ni impide el siguiente tick de cron.
// ============================================================

const logger = require('../../shared/logs/logger');
const { AuditLog } = require('../../models');

/**
 * Loguea el resultado de una corrida de job.
 *
 * @param {string} jobName  — nombre canónico del job (ej: 'reset-invoices-monthly')
 * @param {object} result   — { status, affected, durationMs, error? }
 *   status: 'success' | 'failed' | 'skipped'
 */
function logJobRun(jobName, result) {
    const payload = {
        job: jobName,
        status: result.status,
        affected: result.affected ?? 0,
        durationMs: result.durationMs ?? 0
    };

    if (result.error) payload.error = result.error;

    if (result.status === 'failed') {
        logger.error(`[JOB:${jobName}] failed`, payload);
    } else if (result.status === 'skipped') {
        logger.warn(`[JOB:${jobName}] skipped`, payload);
    } else {
        logger.info(`[JOB:${jobName}] success`, payload);
    }
}

/**
 * Registra en audit_logs la corrida de un job cuando afectó filas.
 * Si affected === 0 → no inserta (evita ruido en la tabla).
 * NUNCA lanza: si el insert falla, lo loguea y retorna null.
 *
 * @param {string} jobName   — nombre del job (se prefija con 'job.')
 * @param {number} affected  — filas afectadas
 * @param {object} meta      — { entity?, companyId?, ...detalles }
 * @returns {Promise<AuditLog|null>}
 */
async function recordJobAudit(jobName, affected, meta = {}) {
    if (!affected || affected <= 0) return null;

    try {
        const after = { affected, ...meta };

        return await AuditLog.create({
            companyId: meta.companyId || null,
            userId: null,
            action: `job.${jobName}`,
            entity: meta.entity || 'job',
            entityId: null,
            before: null,
            after,
            ip: null,
            userAgent: null
        });
    } catch (err) {
        // Un job NO debe morir porque el audit falló.
        logger.error(`[JOB:${jobName}] audit insert failed`, {
            error: err.message,
            affected
        });
        return null;
    }
}

/**
 * Envuelve la función de un job con:
 *   - medición de duración
 *   - captura de errores (NUNCA relanza)
 *   - log estructurado del resultado
 *
 * La función `fn` debe retornar { affected: number, ...meta } o undefined.
 * Si retorna undefined, affected se asume 0.
 *
 * @param {string} jobName
 * @param {() => Promise<object|void>} fn
 * @returns {() => Promise<{status, affected, durationMs, error}>}
 */
function withErrorHandling(jobName, fn) {
    return async function wrappedJob() {
        const startedAt = Date.now();

        try {
            const result = (await fn()) || {};
            const durationMs = Date.now() - startedAt;

            const finalResult = {
                status: 'success',
                affected: result.affected ?? 0,
                durationMs,
                error: null
            };

            logJobRun(jobName, finalResult);
            return finalResult;

        } catch (err) {
            const durationMs = Date.now() - startedAt;

            const finalResult = {
                status: 'failed',
                affected: 0,
                durationMs,
                error: err.message
            };

            logJobRun(jobName, finalResult);
            return finalResult;
        }
    };
}

module.exports = {
    logJobRun,
    recordJobAudit,
    withErrorHandling
};