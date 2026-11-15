// 1. issuedAt: no futuro (create)
// NOTA: el bloque de "no más de 30 días atrás" sigue comentado igual que en el original.
function issuedAtRule(value, helpers) {
    if (value.issuedAt) {
        const issuedAt = new Date(value.issuedAt);
        const now = new Date();

        if (issuedAt > now) {
            return helpers.error('any.custom', { message: 'issuedAt cannot be in the future' });
        }
        // NOTA: el bloque de "no más de 30 días atrás" está comentado para test
        // if (issuedAt < thirtyDaysAgo) {
        //     return helpers.error('any.custom', { message: 'issuedAt cannot be more than 30 days in the past' });
        // }
    }
}


// 1. issuedAt: no futuro y no más de 30 días atrás (update)
function issuedAt30dRule(value, helpers) {
    if (value.issuedAt) {
        const issuedAt = new Date(value.issuedAt);
        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (issuedAt > now) {
            return helpers.error('any.custom', { message: 'issuedAt cannot be in the future' });
        }
        if (issuedAt < thirtyDaysAgo) {
            return helpers.error('any.custom', { message: 'issuedAt cannot be more than 30 days in the past' });
        }
    }
}

module.exports = { issuedAtRule, issuedAt30dRule };