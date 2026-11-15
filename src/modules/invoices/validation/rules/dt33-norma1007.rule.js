// DT33 — indicadorNorma1007 solo en descuentos (tipoAjuste='D'). CREATE + UPDATE.
function dt33Norma1007Rule(value, helpers) {
    if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
        for (let i = 0; i < value.descuentosORecargos.length; i++) {
            const d = value.descuentosORecargos[i];
            if (d.indicadorNorma1007 === 1 && d.tipoAjuste !== 'D') {
                return helpers.error('any.custom', {
                    message: `descuentosORecargos[${i}]: indicadorNorma1007 only applies to descuentos (tipoAjuste="D"), not recargos (tipoAjuste="R")`
                });
            }
        }
    }
}

module.exports = { dt33Norma1007Rule };