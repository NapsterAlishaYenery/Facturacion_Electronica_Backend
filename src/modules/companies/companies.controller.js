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

// ------------------------------------------------------------
// PATCH /api/companies/:id (admin)
// ------------------------------------------------------------
const updateCompanyById = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const company = await companiesService.updateCompanyById(
        req.params.id,
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
// PATCH /api/companies/:id/activate (admin)
// ------------------------------------------------------------
const toggleCompanyActive = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const { isActive } = req.body;

    const company = await companiesService.toggleCompanyActive(
        req.params.id,
        isActive,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: `Company ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { company }
    });
});

// ------------------------------------------------------------
// DELETE /api/companies/:id (admin)
// ------------------------------------------------------------
const deleteCompany = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await companiesService.deleteCompany(
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Company deleted successfully',
        data: result
    });
});

module.exports = {
    getMyCompany,
    updateMyCompany,
    listCompanies,
    getCompanyById,
    updateCompanyById,
    toggleCompanyActive,
    deleteCompany
};