// ============================================================
// Scheduler de jobs programados (node-cron)
//
// Responsabilidades:
//   - Arrancar/parar node-cron en base a ENABLE_JOBS
//   - Registrar cada job con su expresión cron y timezone
//   - Mantener metadata en memoria de la última corrida de cada job
//     (para el endpoint GET /api/admin/jobs — Step 5.9.2)
//
// Uso desde server.js:
//
//   const { startScheduler } = require('./modules/jobs/jobs.scheduler');
//   await sequelize.authenticate();
//   startScheduler();
//
// Uso desde GET /api/admin/jobs (Step 5.9.2):
//
//   const { getScheduledJobs } = require('./modules/jobs/jobs.scheduler');
//   res.json({ jobs: getScheduledJobs() });
// ============================================================

const cron = require('node-cron');
const logger = require('../../shared/logs/logger');

// ============================================================
// Definiciones de jobs
//
// Cada entrada: { name, schedule, timezone, enabled, handler }
//   - name      : identificador canónico (mismo que usa withErrorHandling)
//   - schedule  : expresión cron de 5 campos (min hour dom mon dow)
//   - timezone  : opcional; si falta, usa JOBS_TIMEZONE del .env
//   - enabled   : false = no se monta (útil mientras el job no existe)
//   - handler   : función async () => { affected, ...meta }
//
// ⚠️ Los handlers se irán añadiendo en Steps 5.2 → 5.8.
//    Por ahora todos están enabled: false para que el scheduler
//    arranque con 0 jobs activos y el smoke test pase.
// ============================================================

function buildJobDefinitions() {
    return [
        // ---------------------------------------------------------
        // Step 5.2 — Ciclo de vida de suscripciones
        // ---------------------------------------------------------
        {
            name: 'subscription-lifecycle',
            schedule: '0 0 * * *',       // diario, 00:00
            enabled: true,
            handler: require('./jobs/subscription-lifecycle.job')
        },

        // ---------------------------------------------------------
        // Step 5.3 — Desactivar secuencias expiradas
        // ---------------------------------------------------------
        {
            name: 'check-expiring-sequences',
            schedule: '5 0 * * *',       // diario, 00:05
            enabled: true,
            handler: require('./jobs/check-expiring-sequences.job')
        },

        // ---------------------------------------------------------
        // Step 5.4 — Alertar certificados por expirar
        // ---------------------------------------------------------
        {
            name: 'alert-expiring-certs',
            schedule: '0 6 * * *',       // diario, 06:00
            enabled: true,
            handler: require('./jobs/alert-expiring-certs.job')
        },


        // ---------------------------------------------------------
        // Step 5.5 — Reintentar envíos fallidos a DGII
        // ---------------------------------------------------------
        {
            name: 'retry-failed-sends',
            schedule: '*/30 * * * *',    // cada 30 min
            enabled: true,
            handler: require('./jobs/retry-failed-sends.job')
        },

        // ---------------------------------------------------------
        // Step 5.6 — Consultar estado de facturas pendientes
        // ---------------------------------------------------------
        {
            name: 'poll-pending-status',
            schedule: '*/15 * * * *',    // cada 15 min
            enabled: true,
            handler: require('./jobs/poll-pending-status.job')
        },

        // ----------------------   -----------------------------------
        // Step 5.7 — Generar RFCE mensual
        // ---------------------------------------------------------
        {
            name: 'generate-monthly-rfce',
            schedule: '0 4 1 * *',       // día 1 de cada mes, 04:00
            enabled: false,
            handler: null
        }
    ];
}

// ============================================================
// Estado en memoria (metadata de cada job programado)
// ============================================================

let scheduledJobs = [];    // [{ name, schedule, timezone, cronTask, lastRun }]

// ============================================================
// Arranca el scheduler
// ============================================================

function startScheduler() {
    const enabled = String(process.env.ENABLE_JOBS || '').toLowerCase() === 'true';

    if (!enabled) {
        logger.warn('Scheduler deshabilitado (ENABLE_JOBS != true)');
        return { started: false, jobsCount: 0 };
    }

    const timezone = process.env.JOBS_TIMEZONE || 'America/Santo_Domingo';
    const definitions = buildJobDefinitions();

    scheduledJobs = [];

    for (const def of definitions) {
        if (!def.enabled) continue;

        if (typeof def.handler !== 'function') {
            logger.warn(`Job "${def.name}" enabled pero sin handler — se omite`);
            continue;
        }

        if (!cron.validate(def.schedule)) {
            logger.error(`Expresión cron inválida para "${def.name}": ${def.schedule}`);
            continue;
        }

        const tz = def.timezone || timezone;

        const task = cron.schedule(
            def.schedule,
            async () => {
                logger.info(`[JOB:${def.name}] tick`);
                const result = await def.handler();

                // Guardar metadata de la última corrida (en memoria)
                const record = scheduledJobs.find(j => j.name === def.name);
                if (record) {
                    record.lastRun = {
                        at: new Date().toISOString(),
                        status: result?.status || 'unknown',
                        affected: result?.affected ?? 0,
                        durationMs: result?.durationMs ?? 0,
                        error: result?.error || null
                    };
                }
            },
            { timezone: tz }
        );

        scheduledJobs.push({
            name: def.name,
            schedule: def.schedule,
            timezone: tz,
            cronTask: task,
            lastRun: null
        });

        logger.info(`[JOB:${def.name}] programado`, { schedule: def.schedule, timezone: tz });
    }

    logger.info(`${scheduledJobs.length} jobs programados`);

    return { started: true, jobsCount: scheduledJobs.length };
}

// ============================================================
// Detiene el scheduler (útil para tests y shutdown limpio)
// ============================================================

function stopScheduler() {
    for (const job of scheduledJobs) {
        if (job.cronTask && typeof job.cronTask.stop === 'function') {
            job.cronTask.stop();
        }
    }
    const count = scheduledJobs.length;
    scheduledJobs = [];
    logger.info(`Scheduler detenido (${count} jobs parados)`);
    return { stopped: true, jobsCount: count };
}

// ============================================================
// Devuelve metadata de los jobs programados (para /api/admin/jobs)
// ============================================================

function getScheduledJobs() {
    return scheduledJobs.map(job => ({
        name: job.name,
        schedule: job.schedule,
        timezone: job.timezone,
        lastRun: job.lastRun
    }));
}

module.exports = {
    startScheduler,
    stopScheduler,
    getScheduledJobs
};