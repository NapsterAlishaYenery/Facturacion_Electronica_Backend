// DT30 — fechaDesde ≤ fechaHasta. CREATE + UPDATE.
function fechasRangoRule(value, helpers) {
    if (value.fechaDesde && value.fechaHasta) {
        const desde = new Date(value.fechaDesde);
        const hasta = new Date(value.fechaHasta);
        if (desde > hasta) {
            return helpers.error('any.custom', {
                message: 'fechaDesde cannot be after fechaHasta'
            });
        }
    }
}

module.exports = { fechasRangoRule };