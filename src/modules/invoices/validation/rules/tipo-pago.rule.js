// DT30 — tipoPago ↔ fechaLimitePago (create). 
function tipoPagoRule(value, helpers) {
    // tipoPago=2 → fechaLimitePago obligatoria
    if (Number(value.tipoPago) === 2 && !value.fechaLimitePago) {
        return helpers.error('any.custom', {
            message: 'fechaLimitePago is required when tipoPago=2 (Crédito)'
        });
    }
    // tipoPago != 2 → fechaLimitePago prohibida
    if (value.tipoPago !== undefined && Number(value.tipoPago) !== 2 && value.fechaLimitePago) {
        return helpers.error('any.custom', {
            message: 'fechaLimitePago can only be set when tipoPago=2'
        });
    }
}

module.exports = { tipoPagoRule };