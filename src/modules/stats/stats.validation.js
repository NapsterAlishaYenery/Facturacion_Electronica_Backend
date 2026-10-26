// ============================================================
// Validaciones Joi para el módulo stats
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: query opcional para dashboard company
// (por ahora nada requerido; reservado para futuro)
// ------------------------------------------------------------
const companyStatsQuerySchema = Joi.object({
    // Ejemplo futuro: period en días para la gráfica
    period: Joi.number().integer().min(1).max(90).default(7)
});

// ------------------------------------------------------------
// Schema: query opcional para dashboard admin
// ------------------------------------------------------------
const adminStatsQuerySchema = Joi.object({
    mrrMonths: Joi.number().integer().min(1).max(24).default(6)
});

module.exports = {
    companyStatsQuerySchema,
    adminStatsQuerySchema
};