// DT30 — tipoMoneda.
// - Create valida: no DOP + tipoCambio obligatorio.
// - Update valida: solo no DOP (tipoCambio se puede cambiar en update pero no se exige).

function tipoMonedaCreateRule(value, helpers) {
    // 14. tipoMoneda no puede ser DOP
    if (value.tipoMoneda && String(value.tipoMoneda).toUpperCase() === 'DOP') {
        return helpers.error('any.custom', {
            message: 'tipoMoneda cannot be DOP (the local currency is implicit, omit the field)'
        });
    }
    // 15. Si tipoMoneda viene → tipoCambio obligatorio
    if (value.tipoMoneda && !value.tipoCambio) {
        return helpers.error('any.custom', {
            message: 'tipoCambio is required when tipoMoneda is provided'
        });
    }
}

function tipoMonedaUpdateRule(value, helpers) {
    // 14. tipoMoneda no puede ser DOP
    if (value.tipoMoneda && String(value.tipoMoneda).toUpperCase() === 'DOP') {
        return helpers.error('any.custom', {
            message: 'tipoMoneda cannot be DOP (the local currency is implicit, omit the field)'
        });
    }
}

module.exports = { tipoMonedaCreateRule, tipoMonedaUpdateRule };