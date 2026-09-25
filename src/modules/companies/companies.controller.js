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

// ------------------------------------------------------------
// PATCH /api/companies/me
// ------------------------------------------------------------
const updateMyCompany = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const company = await companiesService.updateMyCompany(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Company updated successfully',
        data: { company }
    });
});

// ------------------------------------------------------------
// GET /api/companies (admin)
// ------------------------------------------------------------
const listCompanies = catchAsync(async (req, res) => {
    const result = await companiesService.listCompanies(req.query);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/companies/:id (admin)
// ------------------------------------------------------------
const getCompanyById = catchAsync(async (req, res) => {
    const result = await companiesService.getCompanyById(req.params.id);

    res.json({
        success: true,
        data: result
    });
});

module.exports = {
    getMyCompany,
    updateMyCompany,
    listCompanies,
    getCompanyById
};