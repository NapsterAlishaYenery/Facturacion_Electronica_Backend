// ============================================================
// Validaciones Joi para el módulo sequences
// Pendiente: agregar schemas cuando se implementen los endpoints
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: filtros de listado (company_admin)
// ------------------------------------------------------------
const listSequencesQuerySchema = Joi.object({
    type: Joi.string().valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47').optional(),
    prefix: Joi.string().max(5).optional(),
    isActive: Joi.boolean().optional(),
    expired: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

module.exports = {
    listSequencesQuerySchema
};

// Schemas planeados:
// - createSequenceSchema
// - updateSequenceSchema
// - toggleSequenceActiveSchema
// - listSequencesQuerySchema
