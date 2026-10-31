// ============================================================
// Job: job-runs-cleanup
//
// Borra filas viejas de job_runs para evitar crecimiento infinito.
// Corre diario a las 03:00 (timezone RD).
//
// Estrategia de retención (opción B):
//   - Borra TODO lo que tenga started_at < now - RETENTION_DAYS
//   - RETENTION_DAYS = 30 por defecto (configurable via env)
//   - Si RETENTION_DAYS = 0 o negativo → skip (modo "no borrar")
//
// Devuelve { affected } = cantidad de filas borradas.
//
// Se monta desde jobs.scheduler.js. Ver Paso 4.
// ============================================================

const { Op } = require('sequelize');
const { JobRun } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'job-runs-cleanup';
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// Retención configurable via env (default 30 días).
// Si es <= 0, el job hace skip (útil para deshabilitar la purga
// sin quitar el job del scheduler).
// ------------------------------------------------------------
function getRetentionDays() {
    const raw = process.env.JOB_RUNS_RETENTION_DAYS;
    if (raw === undefined || raw === null || raw === '') return 30;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 30;
    return n;
}

// ------------------------------------------------------------
// Lógica principal
// ------------------------------------------------------------
async function runJobRunsCleanup() {
    const retentionDays = getRetentionDays();

    // 4.1. Modo deshabilitado: retención <= 0 → no borrar nada
    if (retentionDays <= 0) {
        logger.info(
            `[JOB:${JOB_NAME}] skip (JOB_RUNS_RETENTION_DAYS=${retentionDays})`
        );
        return {
            affected: 0,
            entity: 'job_run',
            reason: 'retention disabled',
            retentionDays
        };
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);

    // 4.2. Contar antes (para el log y el audit)
    const totalBefore = await JobRun.count();

    // 4.3. Borrar
    const deleted = await JobRun.destroy({
        where: {
            startedAt: { [Op.lt]: cutoff }
        }
    });

    const totalAfter = totalBefore - deleted;

    // 4.4. Audit (solo si borró algo — recordJobAudit ya lo respeta)
    if (deleted > 0) {
        await recordJobAudit(JOB_NAME, deleted, {
            entity: 'job_run',
            retentionDays,
            cutoff: cutoff.toISOString(),
            totalBefore,
            totalAfter
        });
    }

    // 4.5. Log
    logger.debug(`[JOB:${JOB_NAME}] resumen`, {
        deleted,
        totalBefore,
        totalAfter,
        retentionDays,
        cutoff: cutoff.toISOString()
    });

    return {
        affected: deleted,
        entity: 'job_run',
        retentionDays,
        cutoff: cutoff.toISOString(),
        totalBefore,
        totalAfter
    };
}

// ============================================================
// Export
// ============================================================
module.exports = withErrorHandling(JOB_NAME, runJobRunsCleanup);
module.exports._raw = runJobRunsCleanup;
module.exports.JOB_NAME = JOB_NAME;
module.exports.getRetentionDays = getRetentionDays;