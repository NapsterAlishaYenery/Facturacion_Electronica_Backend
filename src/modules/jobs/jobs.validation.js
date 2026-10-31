// ============================================================
// Validaciones Joi para el módulo jobs
// Solo lectura: únicamente valida query params del historial.
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: filtros del historial de corridas
// ------------------------------------------------------------
const listJobRunsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    jobName: Joi.string().max(100).optional().allow(''),
    status: Joi.string().valid('success', 'failed', 'skipped').optional(),
    from: Joi.string().isoDate().optional().allow(''),
    to: Joi.string().isoDate().optional().allow('')
});

module.exports = {
    listJobRunsQuerySchema
};