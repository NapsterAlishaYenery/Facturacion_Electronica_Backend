// DT35 — bloques 1 (matriz) + 2 (validar código contra tipo)
//        + 3 (33/34 obligatorios) + 4 (resto condicional). CREATE.
function dt35CodigosRule(value, helpers) {
    const CODIGOS_PERMITIDOS_POR_TIPO = {
        '31': [4, 5],
        '32': [4],
        '33': [1, 2, 3, 4],
        '34': [1, 2, 3, 4],
        '41': [4],
        '43': [4],
        '44': [4],
        '45': [4],
        '46': [4],
        '47': [4]
    };

    // 2. Validar CodigoModificacion contra el tipo
    if (value.modificationCode !== undefined && value.modificationCode !== null) {
        const permitidos = CODIGOS_PERMITIDOS_POR_TIPO[String(value.type)] || [];
        const code = Number(value.modificationCode);

        if (permitidos.length === 0) {
            return helpers.error('any.custom', {
                message: `Tipo ${value.type}: CodigoModificacion no aplica a este tipo de e-CF`
            });
        }
        if (!permitidos.includes(code)) {
            return helpers.error('any.custom', {
                message: `Tipo ${value.type}: CodigoModificacion=${code} no permitido. Valores permitidos: [${permitidos.join(', ')}]. ` +
                    `Recuerda: 1, 2, 3 solo aplican a Notas (33/34); 5 solo aplica a FC Fiscal (31).`
            });
        }
    }

    // 3. En 33/34: NCFModificado, FechaNCFModificado y CodigoModificacion son OBLIGATORIOS
    if (value.type === '33' || value.type === '34') {
        if (!value.modifiedNcf) {
            return helpers.error('any.custom', {
                message: `Tipo ${value.type}: NCFModificado es obligatorio (el bloque <InformacionReferencia> es obligatorio en Notas)`
            });
        }
        if (!value.modifiedNcfDate) {
            return helpers.error('any.custom', {
                message: `Tipo ${value.type}: FechaNCFModificado es obligatoria (el bloque <InformacionReferencia> es obligatorio en Notas)`
            });
        }
        if (value.modificationCode === undefined || value.modificationCode === null) {
            return helpers.error('any.custom', {
                message: `Tipo ${value.type}: CodigoModificacion es obligatorio (el bloque <InformacionReferencia> es obligatorio en Notas)`
            });
        }
    }

    // 4. En el resto de tipos: si viene modifiedNcf, el bloque se emite completo.
    if (value.type !== '33' && value.type !== '34') {
        const tieneNcfModificado = value.modifiedNcf !== undefined
            && value.modifiedNcf !== null
            && String(value.modifiedNcf).trim() !== '';

        if (tieneNcfModificado) {
            if (!value.modifiedNcfDate) {
                return helpers.error('any.custom', {
                    message: `Tipo ${value.type}: si envías NCFModificado, FechaNCFModificado es obligatoria (el bloque <InformacionReferencia> se emitirá)`
                });
            }
            if (value.modificationCode === undefined || value.modificationCode === null) {
                return helpers.error('any.custom', {
                    message: `Tipo ${value.type}: si envías NCFModificado, CodigoModificacion es obligatorio (el bloque <InformacionReferencia> se emitirá)`
                });
            }
        } else {
            if (value.modificationCode !== undefined && value.modificationCode !== null) {
                return helpers.error('any.custom', {
                    message: `Tipo ${value.type}: CodigoModificacion solo aplica si envías NCFModificado (el bloque <InformacionReferencia> requiere NCFModificado)`
                });
            }
            if (value.modifiedNcfDate) {
                return helpers.error('any.custom', {
                    message: `Tipo ${value.type}: FechaNCFModificado solo aplica si envías NCFModificado`
                });
            }
            if (value.modifiedNcfIssuerRnc) {
                return helpers.error('any.custom', {
                    message: `Tipo ${value.type}: RNCOtroContribuyente solo aplica si envías NCFModificado`
                });
            }
        }
    }
}

module.exports = { dt35CodigosRule };