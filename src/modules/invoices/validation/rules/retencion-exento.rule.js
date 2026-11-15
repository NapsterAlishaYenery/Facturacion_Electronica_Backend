// DT31 — bloque 12: exento + retención tipo 1 → montoItbisRetenido=0. CREATE.
// NOTA: esta regla MUTA value (así está en el original). No es un error de validación.
function retencionExentoRule(value, helpers) {
    for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];
        const ind = Number(item.indicadorFacturacion ?? 4);
        if (ind === 4 && item.retencion && item.retencion.indicador === 1) {
            item.retencion.montoItbisRetenido = 0;
        }
    }
}

module.exports = { retencionExentoRule };