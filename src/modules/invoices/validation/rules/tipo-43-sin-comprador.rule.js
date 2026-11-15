// 5. 43 (Gastos Menores) no admite comprador. CREATE.
function tipo43SinCompradorRule(value, helpers) {
    if (value.type === '43' && (value.receiverRnc || value.receiverName)) {
        return helpers.error('any.custom', {
            message: 'Type 43 (Gastos Menores) cannot have a buyer'
        });
    }
}

module.exports = { tipo43SinCompradorRule };