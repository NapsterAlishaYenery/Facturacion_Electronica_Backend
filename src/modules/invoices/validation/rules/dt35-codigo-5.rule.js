// DT35 — bloque 7 (código 5): NCF debe ser e-NCF 13 chars E. CREATE.
function dt35Codigo5Rule(value, helpers) {
    if (Number(value.modificationCode) === 5 && value.modifiedNcf) {
        const ncf = String(value.modifiedNcf).trim();
        if (ncf.length !== 13 || !/^E/.test(ncf)) {
            return helpers.error('any.custom', {
                message: `CodigoModificacion=5: NCFModificado debe ser un e-NCF de 13 caracteres que empiece con E. Recibido: "${ncf}"`
            });
        }
    }
}

module.exports = { dt35Codigo5Rule };