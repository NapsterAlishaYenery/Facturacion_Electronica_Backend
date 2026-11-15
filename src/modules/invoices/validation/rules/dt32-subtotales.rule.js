// DT32 — subtotales.
// Create: (a) único, (b) subtotalId ∈ declarados, (c) declarado con líneas, (d) sin huérfanos.
// Update: (a) único + coherencia subtotalId si vienen items.

function dt32SubtotalesCreateRule(value, helpers) {
    if (value.subtotales && value.subtotales.length > 0) {
        // (a) numeroSubtotal único
        const numeros = value.subtotales.map(s => s.numeroSubtotal);
        if (new Set(numeros).size !== numeros.length) {
            return helpers.error('any.custom', {
                message: 'subtotales: numeroSubtotal debe ser único dentro del array'
            });
        }

        // (b) Cada subtotalId usado en items debe existir en subtotales[]
        const subtotalIdsDeclarados = new Set(numeros);
        const subtotalIdsUsados = new Set();

        for (let i = 0; i < value.items.length; i++) {
            const sid = value.items[i].subtotalId;
            if (sid !== undefined && sid !== null) {
                if (!subtotalIdsDeclarados.has(sid)) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: subtotalId=${sid} no está declarado en subtotales[]. Agrega { numeroSubtotal: ${sid} } o quita el subtotalId de la línea.`
                    });
                }
                subtotalIdsUsados.add(sid);
            }
        }

        // (c) Cada subtotal declarado debe tener al menos una línea
        for (const n of numeros) {
            if (!subtotalIdsUsados.has(n)) {
                return helpers.error('any.custom', {
                    message: `subtotales: numeroSubtotal=${n} no tiene ninguna línea asignada. Asigna al menos un item con subtotalId=${n}.`
                });
            }
        }
    }

    // (d) Si algún item tiene subtotalId pero no se mandó subtotales[]
    if (!value.subtotales || value.subtotales.length === 0) {
        for (let i = 0; i < value.items.length; i++) {
            const sid = value.items[i].subtotalId;
            if (sid !== undefined && sid !== null) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: tiene subtotalId=${sid} pero no se envió el array subtotales[]. Si quieres subtotales, declara los grupos; si no, quita el subtotalId de las líneas.`
                });
            }
        }
    }
}

function dt32SubtotalesUpdateRule(value, helpers) {
    if (value.subtotales && value.subtotales.length > 0) {
        const numeros = value.subtotales.map(s => s.numeroSubtotal);
        if (new Set(numeros).size !== numeros.length) {
            return helpers.error('any.custom', {
                message: 'subtotales: numeroSubtotal debe ser único dentro del array'
            });
        }

        if (value.items) {
            const subtotalIdsDeclarados = new Set(numeros);
            for (let i = 0; i < value.items.length; i++) {
                const sid = value.items[i].subtotalId;
                if (sid !== undefined && sid !== null && !subtotalIdsDeclarados.has(sid)) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: subtotalId=${sid} no está declarado en subtotales[]`
                    });
                }
            }
        }
    }
}

module.exports = { dt32SubtotalesCreateRule, dt32SubtotalesUpdateRule };