// 2. Por línea: coherencia indicador ↔ itbisRate + discount
//    + reglas cruzadas DGII (Step 4). CREATE.
function itemsLineCoherenceRule(value, helpers) {
    const expectedRates = {
        0: 0,    // No Facturable
        1: 18,   // ITBIS 18%
        2: 16,   // ITBIS 16%
        3: 0,    // ITBIS 3 (0% gravado)
        4: 0     // Exento
    };

    for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];

        // 2.a. Coherencia indicador ↔ tasa
        let indicador = item.indicadorFacturacion;

        if (indicador === undefined) {
            if (item.itbisRate === 18) indicador = 1;
            else if (item.itbisRate === 16) indicador = 2;
            else if (item.itbisRate === 0) indicador = 4;
            else indicador = 4;
        }

        const expectedRate = expectedRates[indicador];
        if (item.itbisRate !== undefined && Number(item.itbisRate) !== expectedRate) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: itbisRate (${item.itbisRate}) no coincide con indicadorFacturacion=${indicador} (esperado ${expectedRate}). Usa 1=18%, 2=16%, 3=0% gravado, 4=exento.`
            });
        }

        // 2.c. discount no puede superar quantity × unitPrice
        const lineBase = (item.quantity * item.unitPrice) - item.discount;
        if (lineBase < 0) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
            });
        }

        // 2.d. Bien requiere unidadMedida (regla estricta DGII)
        const indicadorBienoServicio = item.indicadorBienoServicio ?? 1;
        if (indicadorBienoServicio === 1) {
            if (item.unidadMedida === undefined || item.unidadMedida === null) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.`
                });
            }
        }

        // 2.e. Coherencia cantidadReferencia ↔ unidadReferencia
        const hasCantRef = item.cantidadReferencia !== undefined && item.cantidadReferencia !== null;
        const hasUniRef = item.unidadReferencia !== undefined && item.unidadReferencia !== null;
        if (hasCantRef && !hasUniRef) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: unidadReferencia is required when cantidadReferencia is provided`
            });
        }
        if (hasUniRef && !hasCantRef) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: cantidadReferencia is required when unidadReferencia is provided`
            });
        }

        // 2.f. fechaVencimientoItem >= fechaElaboracion
        if (item.fechaElaboracion && item.fechaVencimientoItem) {
            const elab = new Date(item.fechaElaboracion);
            const venc = new Date(item.fechaVencimientoItem);
            if (venc < elab) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: fechaVencimientoItem (${item.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${item.fechaElaboracion})`
                });
            }
        }

        // 2.g. gradosAlcohol solo aplica a bienes
        if (indicadorBienoServicio === 2
            && item.gradosAlcohol !== undefined
            && item.gradosAlcohol !== null) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios`
            });
        }
    }
}

// Bloque 2 + Bloque 4 del update: por línea.
// Se mantienen DOS for consecutivos para replicar el orden exacto de validación
// del original (primero indicador/discount, después unidad/refs/fechas/grados).
function itemsLineCoherenceUpdateRule(value, helpers) {
    if (!value.items) return;

    const expectedRates = { 0: 0, 1: 18, 2: 16, 3: 0, 4: 0 };

    // ---- Bloque 2 original ----
    for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];

        let indicador = item.indicadorFacturacion;
        if (indicador === undefined) {
            if (item.itbisRate === 18) indicador = 1;
            else if (item.itbisRate === 16) indicador = 2;
            else if (item.itbisRate === 0) indicador = 4;
            else indicador = 4;
        }

        const expectedRate = expectedRates[indicador];
        if (item.itbisRate !== undefined && Number(item.itbisRate) !== expectedRate) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: itbisRate (${item.itbisRate}) no coincide con indicadorFacturacion=${indicador} (esperado ${expectedRate}). Usa 1=18%, 2=16%, 3=0% gravado, 4=exento.`
            });
        }

        const lineBase = (item.quantity * item.unitPrice) - item.discount;
        if (lineBase < 0) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
            });
        }
    }

    // ---- Bloque 4 original ----
    for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];
        const indicadorBienoServicio = item.indicadorBienoServicio ?? 1;

        // (1) Bien requiere unidadMedida
        if (indicadorBienoServicio === 1) {
            if (item.unidadMedida === undefined || item.unidadMedida === null) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.`
                });
            }
        }

        // (2) cantidadReferencia ↔ unidadReferencia
        const hasCantRef = item.cantidadReferencia !== undefined && item.cantidadReferencia !== null;
        const hasUniRef = item.unidadReferencia !== undefined && item.unidadReferencia !== null;
        if (hasCantRef && !hasUniRef) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: unidadReferencia is required when cantidadReferencia is provided`
            });
        }
        if (hasUniRef && !hasCantRef) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: cantidadReferencia is required when unidadReferencia is provided`
            });
        }

        // (3) fechaVencimientoItem >= fechaElaboracion
        if (item.fechaElaboracion && item.fechaVencimientoItem) {
            const elab = new Date(item.fechaElaboracion);
            const venc = new Date(item.fechaVencimientoItem);
            if (venc < elab) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: fechaVencimientoItem (${item.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${item.fechaElaboracion})`
                });
            }
        }

        // (4) gradosAlcohol solo en bienes
        if (indicadorBienoServicio === 2
            && item.gradosAlcohol !== undefined
            && item.gradosAlcohol !== null) {
            return helpers.error('any.custom', {
                message: `Item ${i + 1}: gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios`
            });
        }
    }
}


module.exports = { itemsLineCoherenceRule, itemsLineCoherenceUpdateRule };