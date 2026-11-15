// DT35 — update: modificationCode debe ser entero 1-5 (sin conocer type).
function dt35RangoUpdateRule(value, helpers) {
    if (value.modificationCode !== undefined && value.modificationCode !== null) {
        const code = Number(value.modificationCode);
        if (!Number.isInteger(code) || code < 1 || code > 5) {
            return helpers.error('any.custom', {
                message: `CodigoModificacion debe ser un entero entre 1 y 5. Recibido: ${value.modificationCode}`
            });
        }
    }
}

module.exports = { dt35RangoUpdateRule };