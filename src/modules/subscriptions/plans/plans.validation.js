// ============================================================
// Validaciones Joi para planes
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: listar planes (público)
// ------------------------------------------------------------
const listPlansQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
    listPlansQuerySchema
};
