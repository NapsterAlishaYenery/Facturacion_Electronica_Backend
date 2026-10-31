// ============================================================
// Servicio de jobs
// Solo lectura: expone estado del scheduler y historial de corridas.
// ============================================================

const { Op } = require('sequelize');
const { JobRun } = require('../../models');
const { getScheduledJobs } = require('./jobs.scheduler');

// ------------------------------------------------------------
// Estado actual del scheduler + última corrida por job.
//
// Combina:
//   - Definiciones en memoria (scheduler): name, schedule, timezone
//   - Última corrida persistida en BD: JobRun (más fiable que memoria)
//   - Fallback a lastRun en memoria si no hay fila en BD
// ------------------------------------------------------------
async function getJobsOverview() {
    const scheduled = getScheduledJobs();   // [{ name, schedule, timezone, lastRun }]
    const names = scheduled.map(j => j.name);

    // Traer el último JobRun por cada job en 1 query
    let latestByJob = new Map();
    if (names.length > 0) {
        const runs = await JobRun.findAll({
            where: { jobName: { [Op.in]: names } },
            order: [['startedAt', 'DESC']]
        });

        // Nos quedamos con el primero por jobName (el más reciente)
        for (const run of runs) {
            if (!latestByJob.has(run.jobName)) {
                latestByJob.set(run.jobName, run);
            }
        }
    }

    return {
        enabled: String(process.env.ENABLE_JOBS || '').toLowerCase() === 'true',
        timezone: process.env.JOBS_TIMEZONE || 'America/Santo_Domingo',
        jobs: scheduled.map(j => {
            const dbRun = latestByJob.get(j.name) || null;

            // Prioridad: BD > memoria > null
            let lastRun = null;
            if (dbRun) {
                lastRun = {
                    at: dbRun.startedAt,
                    status: dbRun.status,
                    affected: dbRun.affected,
                    durationMs: dbRun.durationMs,
                    error: dbRun.error,
                    triggeredBy: dbRun.triggeredBy
                };
            } else if (j.lastRun) {
                lastRun = {
                    at: j.lastRun.at,
                    status: j.lastRun.status,
                    affected: j.lastRun.affected,
                    durationMs: j.lastRun.durationMs,
                    error: j.lastRun.error,
                    triggeredBy: 'cron'
                };
            }

            return {
                name: j.name,
                schedule: j.schedule,
                timezone: j.timezone,
                lastRun
            };
        })
    };
}

// ------------------------------------------------------------
// Historial paginado de corridas
// ------------------------------------------------------------
async function listJobRuns(filters = {}) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const where = {};

    if (filters.jobName) where.jobName = filters.jobName;
    if (filters.status) where.status = filters.status;

    if (filters.from || filters.to) {
        where.startedAt = {};
        if (filters.from) where.startedAt[Op.gte] = new Date(filters.from);
        if (filters.to) where.startedAt[Op.lte] = new Date(filters.to);
    }

    const { count, rows } = await JobRun.findAndCountAll({
        where,
        order: [['startedAt', 'DESC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items: rows,
        pagination: {
            page,
            limit,
            totalItems: count,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

module.exports = {
    getJobsOverview,
    listJobRuns
};