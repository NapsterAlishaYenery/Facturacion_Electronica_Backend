// ============================================================
// Controlador de jobs
// Solo maneja HTTP: llama al service, responde.
// ============================================================

const jobsService = require('./jobs.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/jobs
// Estado actual del scheduler + última corrida por job
// ------------------------------------------------------------
const getOverview = catchAsync(async (req, res) => {
    const data = await jobsService.getJobsOverview();

    res.json({
        success: true,
        message: 'OK',
        data
    });
});

// ------------------------------------------------------------
// GET /api/jobs/runs
// Historial paginado de corridas
// ------------------------------------------------------------
const listRuns = catchAsync(async (req, res) => {
    const result = await jobsService.listJobRuns(req.validated.query);

    res.json({
        success: true,
        message: 'OK',
        data: {
            runs: result.items,
            pagination: result.pagination
        }
    });
});

module.exports = {
    getOverview,
    listRuns
};