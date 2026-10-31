// ============================================================
// Controlador de auditoría
// Solo maneja HTTP: llama al service, responde.
// ============================================================

const auditService = require('./audit.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/admin/audit
// Listado paginado con filtros
// ------------------------------------------------------------
const listAuditLogs = catchAsync(async (req, res) => {
    const result = await auditService.listAuditLogs(req.validated.query);

    res.json({
        success: true,
        message: 'OK',
        data: {
            logs: result.items,
            pagination: result.pagination
        }
    });
});

// ------------------------------------------------------------
// GET /api/admin/audit/actions
// Lista de actions distintas (para <select> del frontend)
// ------------------------------------------------------------
const listActions = catchAsync(async (req, res) => {
    const actions = await auditService.listDistinctActions();

    res.json({
        success: true,
        message: 'OK',
        data: { actions }
    });
});

module.exports = {
    listAuditLogs,
    listActions
};