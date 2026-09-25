// ============================================================
// Servicio de secuencias
// Pendiente: agregar funciones cuando se implementen los endpoints
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Company, Sequence, Invoice, AuditLog } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// Funciones planeadas:
// - listMySequences (company_admin)
// - getMySequenceById (company_admin)
// - createMySequence (company_admin)
// - updateMySequence (company_admin)
// - toggleMySequenceActive (company_admin)
// - deleteMySequence (company_admin)
// - listAllSequences (admin)

module.exports = {
    // Por ahora vacío
};