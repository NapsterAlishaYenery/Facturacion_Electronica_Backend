// DT35 — bloque 6 (código 4): NCF debe ser electrónico o de papel. CREATE.
function dt35NcfFormatoRule(value, helpers) {
    if (Number(value.modificationCode) === 4 && value.modifiedNcf) {
        const ncf = String(value.modifiedNcf).trim();
        const esElectronico = ncf.length === 13 && /^E/.test(ncf);
        const esPapel = (ncf.length === 11 || ncf.length === 19)
            && /^[AB]/.test(ncf);

        console.log('[DT35-DEBUG bloque 6]', {
            type: value.type,
            modificationCode: value.modificationCode,
            modifiedNcf: value.modifiedNcf,
            ncfLength: ncf.length,
            esElectronico,
            esPapel,
            debeFallar: !esElectronico && !esPapel
        });

        if (!esElectronico && !esPapel) {
            return helpers.error('any.custom', {
                message: `CodigoModificacion=4: NCFModificado debe ser electrónico (13 chars, empieza con E) o de papel (11 o 19 chars, empieza con A o B). Recibido: "${ncf}"`
            });
        }
    }
}

module.exports = { dt35NcfFormatoRule };