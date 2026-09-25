// ============================================================
// Controlador de empresas
// Solo maneja HTTP: llama al servicio, responde
// ============================================================

const companiesService = require('./companies.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/companies/me
// ------------------------------------------------------------
const getMyCompany = catchAsync(async (req, res) => {
    const result = await companiesService.getMyCompany(req.user.companyId);

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    getMyCompany
};