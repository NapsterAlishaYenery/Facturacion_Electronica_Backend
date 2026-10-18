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
    const result = await companiesService.listCompanies(req.validated.query);

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

// ------------------------------------------------------------
// PATCH /api/companies/me/certificate
// El archivo ya fue procesado por multer → req.file
// El password ya fue validado por Joi → req.body.password
// ------------------------------------------------------------
const uploadCertificate = catchAsync(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'CERTIFICATE_FILE_REQUIRED',
                message: 'No file uploaded. Send a .p12 or .pfx file in the "certificate" field.'
            }
        });
    }

    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const company = await companiesService.uploadCertificate(
        req.user.companyId,
        req.file.buffer,
        req.body.password,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Certificate uploaded successfully',
        data: { company }
    });
});

// ------------------------------------------------------------
// GET /api/companies/me/certificate
// Devuelve metadata del certificado (sin archivo ni password)
// ------------------------------------------------------------
const getMyCertificate = catchAsync(async (req, res) => {
    const result = await companiesService.getMyCertificate(req.user.companyId);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// DELETE /api/companies/me/certificate
// Revoca el certificado (borra archivo + limpia campos)
// ------------------------------------------------------------
const revokeCertificate = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await companiesService.revokeCertificate(
        req.user.companyId,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Certificate revoked successfully',
        data: result
    });
});

// ------------------------------------------------------------
// UPLOAD /api/companies/me/logo
// carga un logo para la empresa 
// ------------------------------------------------------------
const uploadLogo = catchAsync(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'LOGO_FILE_REQUIRED',
                message: 'No file uploaded. Send an image in the "logo" field.'
            }
        });
    }

    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const logo = await companiesService.uploadCompanyLogo(
        req.user.companyId,
        req.file.buffer,
        req.body.purpose,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Logo uploaded successfully',
        data: { logo }
    });
});

// ------------------------------------------------------------
// DELETE /api/companies/me/logo/:purpose
// Borra el logo de un propósito específico (Cloudinary + BD)
// El purpose ya fue validado por Joi → req.validated.params.purpose
// ------------------------------------------------------------
const deleteLogo = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await companiesService.deleteCompanyLogo(
        req.user.companyId,
        req.validated.params.purpose,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Logo deleted successfully',
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
    deleteCompany,
    uploadCertificate,
    getMyCertificate,
    revokeCertificate,
    uploadLogo,
    deleteLogo
};