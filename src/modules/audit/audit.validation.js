// ============================================================
// Validaciones Joi para el módulo audit
// Solo lectura: únicamente valida query params del listado.
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: filtros del listado
// ------------------------------------------------------------
const listAuditQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    companyId: Joi.string().uuid().optional(),
    userId: Joi.string().uuid().optional(),
    entityId: Joi.string().uuid().optional(),
    entity: Joi.string().max(50).optional().allow(''),
    action: Joi.string().max(100).optional().allow(''),
    search: Joi.string().max(100).optional().allow(''),
    from: Joi.string().isoDate().optional().allow(''),
    to: Joi.string().isoDate().optional().allow(''),
    // Preset útil para el admin: ver solo acciones de jobs (cron)
    onlyJobs: Joi.boolean().optional().default(false)
});

module.exports = {
    listAuditQuerySchema
};