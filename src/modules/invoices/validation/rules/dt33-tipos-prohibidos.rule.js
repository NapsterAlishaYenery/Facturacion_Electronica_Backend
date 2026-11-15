// DT33 — 43 y 47 no admiten descuentos/recargos globales. CREATE.
function dt33TiposProhibidosRule(value, helpers) {
    if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
        if (value.type === '43' || value.type === '47') {
            return helpers.error('any.custom', {
                message: `Type ${value.type} does not allow descuentosORecargos (global discounts/charges)`
            });
        }
    }
}

module.exports = { dt33TiposProhibidosRule };