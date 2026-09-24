// ============================================================
// Helper para envolver controladores async
// Captura errores automáticamente y los pasa a next()
// Evita repetir try/catch en cada controlador
// ============================================================

function catchAsync(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = catchAsync;