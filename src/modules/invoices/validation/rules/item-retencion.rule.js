// Bloque 3 del update: retención por línea (indicador 1 o 2).
function itemRetencionRule(value, helpers) {
    if (!value.items) return;

    for (let i = 0; i < value.items.length; i++) {
        const ret = value.items[i].retencion;
        if (ret !== undefined && ret !== null) {
            if (ret.indicador !== 1 && ret.indicador !== 2) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: retencion.indicador must be 1 (Retención) or 2 (Percepción)`
                });
            }
        }
    }
}

module.exports = { itemRetencionRule };