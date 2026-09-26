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
        data: result
    });
});

module.exports = {
    listMySequences
};
// Controladores planeados:
// - listMySequences
// - getMySequenceById
// - createMySequence
// - updateMySequence
// - toggleMySequenceActive
// - deleteMySequence
// - listAllSequences