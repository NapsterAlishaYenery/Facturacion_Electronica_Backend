// 6. 46 / 47 requieren identificador extranjero si no hay RNC. CREATE.
function tipo46y47ExtranjeroRule(value, helpers) {
    if ((value.type === '46' || value.type === '47')
        && !value.receiverRnc
        && !value.receiverIdentificadorExtranjero) {
        return helpers.error('any.custom', {
            message: `Type ${value.type} requires receiverRnc or receiverIdentificadorExtranjero`
        });
    }
}

module.exports = { tipo46y47ExtranjeroRule };