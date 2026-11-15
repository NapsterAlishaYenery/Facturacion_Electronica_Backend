// DT31 — bloque 10: indicadorFacturacion forzado por tipo. CREATE.
function indicadorForzadoPorTipoRule(value, helpers) {
    // 43, 44, 47 → 4 (Exento)
    if (['43', '44', '47'].includes(value.type)) {
        for (let i = 0; i < value.items.length; i++) {
            const ind = Number(value.items[i].indicadorFacturacion ?? 4);
            if (ind !== 4) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: type ${value.type} requires indicadorFacturacion=4 (Exento)`
                });
            }
        }
    }
    // 46 → 3 (ITBIS 0%)
    if (value.type === '46') {
        for (let i = 0; i < value.items.length; i++) {
            const ind = Number(value.items[i].indicadorFacturacion ?? 4);
            if (ind !== 3) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: type 46 requires indicadorFacturacion=3 (ITBIS 0%)`
                });
            }
        }
    }
}

module.exports = { indicadorForzadoPorTipoRule };