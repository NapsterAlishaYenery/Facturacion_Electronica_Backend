// 16. Tipo 46 (Exportación): receiverPais obligatorio. CREATE.
function tipo46PaisRule(value, helpers) {
    if (value.type === '46' && !value.receiverPais) {
        return helpers.error('any.custom', {
            message: 'Type 46 (Exportación) requires receiverPais'
        });
    }
}

module.exports = { tipo46PaisRule };