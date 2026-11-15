// 13. e-CF 32: si el total >= 250,000 requiere identificación del comprador. CREATE.
function tipo32MontoRule(value, helpers) {
    if (value.type === '32') {
        const total = value.items.reduce((sum, it) => {
            const base = (it.quantity * it.unitPrice)
                - (it.discount || 0)
                + (it.recargo || 0);
            const itbis = base * ((it.itbisRate ?? 18) / 100);
            return sum + base + itbis;
        }, 0);

        if (total >= 250000) {
            if (!value.receiverRnc) {
                return helpers.error('any.custom', {
                    message: 'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)'
                });
            }
            if (!value.receiverName) {
                return helpers.error('any.custom', {
                    message: 'Type 32 with total >= 250,000 requires receiverName (DGII rule)'
                });
            }
        }
    }
}

module.exports = { tipo32MontoRule };