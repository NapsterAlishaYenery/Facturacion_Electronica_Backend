// 4. Coherencia por tipo: comprador obligatorio. CREATE.
function compradorPorTipoRule(value, helpers) {
    const typeNeedsRnc = ['31', '41', '45'];
    const typeNeedsRazonSocial = ['31', '41', '44', '45', '46'];

    if (typeNeedsRnc.includes(value.type) && !value.receiverRnc) {
        return helpers.error('any.custom', {
            message: `Type ${value.type} requires receiverRnc`
        });
    }
    if (typeNeedsRazonSocial.includes(value.type) && !value.receiverName) {
        return helpers.error('any.custom', {
            message: `Type ${value.type} requires receiverName`
        });
    }
}

module.exports = { compradorPorTipoRule };