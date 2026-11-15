// DT33 — si hay múltiples indicadores, tipoValor debe ser "%". CREATE + UPDATE.
function dt33TipoValorRule(value, helpers) {
    if (value.descuentosORecargos && value.descuentosORecargos.length > 0 && value.items) {
        const indicadoresEnItems = new Set(
            value.items.map(it => Number(it.indicadorFacturacion ?? 4))
        );
        const hayMultiplesIndicadores = indicadoresEnItems.size > 1;

        if (hayMultiplesIndicadores) {
            for (let i = 0; i < value.descuentosORecargos.length; i++) {
                const d = value.descuentosORecargos[i];
                if (d.tipoValor === '$') {
                    return helpers.error('any.custom', {
                        message: `descuentosORecargos[${i}]: cuando hay ítems con distintos indicadores de facturación, tipoValor debe ser "%" (porcentaje), no "$"`
                    });
                }
            }
        }
    }
}

module.exports = { dt33TipoValorRule };