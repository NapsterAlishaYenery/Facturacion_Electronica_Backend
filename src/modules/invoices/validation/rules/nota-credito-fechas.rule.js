// 3. Coherencia IndicadorNotaCredito con fechas (regla DGII). CREATE.
function notaCreditoFechasRule(value, helpers) {
    if (value.type === '34' && value.modifiedNcfDate && value.indicadorNotaCredito !== undefined) {
        const modDate = new Date(value.modifiedNcfDate);
        const issuedDate = value.issuedAt ? new Date(value.issuedAt) : new Date();
        const diffDays = (issuedDate - modDate) / (1000 * 60 * 60 * 24);

        if (diffDays > 30 && value.indicadorNotaCredito !== 1) {
            return helpers.error('any.custom', {
                message: 'IndicadorNotaCredito must be 1 when the original NCF is more than 30 days old'
            });
        }
        if (diffDays <= 30 && value.indicadorNotaCredito !== 0) {
            return helpers.error('any.custom', {
                message: 'IndicadorNotaCredito must be 0 when the original NCF is 30 days old or less'
            });
        }
    }
}

module.exports = { notaCreditoFechasRule };