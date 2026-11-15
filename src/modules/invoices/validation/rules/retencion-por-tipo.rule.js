// DT31 — bloques 8 (retención solo en ciertos tipos) + 9 (41/47 requieren retención). CREATE.
function retencionPorTipoRule(value, helpers) {
    const tiposConRetencion = ['31', '33', '34', '41', '47'];

    // 8. Retención por línea: solo permitida en 31, 33, 34, 41, 47
    if (!tiposConRetencion.includes(value.type)) {
        for (let i = 0; i < value.items.length; i++) {
            if (value.items[i].retencion) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: retencion only applies to types 31, 33, 34, 41 and 47`
                });
            }
        }
    }

    // 9. Tipos 41 y 47: cada línea DEBE llevar retención
    if (['41', '47'].includes(value.type)) {
        for (let i = 0; i < value.items.length; i++) {
            if (!value.items[i].retencion) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: retencion is required for types 41 and 47`
                });
            }
        }
    }
}

module.exports = { retencionPorTipoRule };