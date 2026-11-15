// DT33 — numeroLinea único. CREATE + UPDATE.
function dt33NumeroLineaRule(value, helpers) {
    if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
        const numeros = value.descuentosORecargos.map(d => d.numeroLinea);
        const unicos = new Set(numeros);
        if (unicos.size !== numeros.length) {
            return helpers.error('any.custom', {
                message: 'descuentosORecargos: numeroLinea debe ser único dentro del array'
            });
        }
    }
}

module.exports = { dt33NumeroLineaRule };