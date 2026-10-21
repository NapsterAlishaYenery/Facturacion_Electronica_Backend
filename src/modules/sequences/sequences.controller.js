// ============================================================
// Controlador de secuencias
// Pendiente: agregar controladores cuando se implementen los endpoints
// ============================================================

const sequencesService = require('./sequences.service');
const catchAsync = require('../../shared/utils/catchAsync');


// ------------------------------------------------------------
// GET /api/sequences/me
// ------------------------------------------------------------
const listMySequences = catchAsync(async (req, res) => {
    const result = await sequencesService.listMySequences(
        req.user.companyId,
        req.validated.query
    );

    res.json({
        success: true,
        message: 'OK',
        data: {
            sequences: result.items,
            pagination: result.pagination
        }
    });
});

// ------------------------------------------------------------
// GET /api/sequences/me/:id
// ------------------------------------------------------------
const getMySequenceById = catchAsync(async (req, res) => {
    const result = await sequencesService.getMySequenceById(
        req.user.companyId,
        req.params.id
    );

    res.json({
        success: true,
        message: 'OK',
        data: { sequence: result.sequence }
    });
});

// ------------------------------------------------------------
// POST /api/sequences/me
// ------------------------------------------------------------
const createMySequence = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await sequencesService.createMySequence(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    res.status(201).json({
        success: true,
        message: 'Sequence created successfully',
        data: { sequence: result.sequence }
    });
});

// ------------------------------------------------------------
// PATCH /api/sequences/me/:id
// ------------------------------------------------------------
const updateMySequence = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await sequencesService.updateMySequence(
        req.user.companyId,
        req.params.id,
        req.body,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Sequence updated successfully',
        data: { sequence: result.sequence }
    });
});

// ------------------------------------------------------------
// PATCH /api/sequences/me/:id/activate
// ------------------------------------------------------------
const toggleMySequenceActive = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const { isActive } = req.body;

    const result = await sequencesService.toggleMySequenceActive(
        req.user.companyId,
        req.params.id,
        isActive,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: `Sequence ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { sequence: result.sequence }
    });
});

// ------------------------------------------------------------
// DELETE /api/sequences/me/:id
// ------------------------------------------------------------
const deleteMySequence = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await sequencesService.deleteMySequence(
        req.user.companyId,
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'Sequence deleted successfully'
    });
});

// ------------------------------------------------------------
// GET /api/sequences (admin)
// ------------------------------------------------------------
const listAllSequences = catchAsync(async (req, res) => {
    const result = await sequencesService.listAllSequences(req.validated.query);
    
    res.json({
        success: true,
        message: 'OK',
        data: {
            sequences: result.items,
            pagination: result.pagination
        }
    });
})

module.exports = {
    listMySequences,
    getMySequenceById,
    createMySequence,
    updateMySequence,
    toggleMySequenceActive,
    deleteMySequence,
    listAllSequences
};
