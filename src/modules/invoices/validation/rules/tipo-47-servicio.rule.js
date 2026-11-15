// DT31 — bloque 11: tipo 47 requiere indicadorBienoServicio=2. CREATE.
function tipo47ServicioRule(value, helpers) {
    if (value.type === '47') {
        for (let i = 0; i < value.items.length; i++) {
            const ind = Number(value.items[i].indicadorBienoServicio ?? 1);
            if (ind !== 2) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: type 47 requires indicadorBienoServicio=2 (Servicio)`
                });
            }
        }
    }
}

module.exports = { tipo47ServicioRule };