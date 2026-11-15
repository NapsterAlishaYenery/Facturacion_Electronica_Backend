// ============================================================
// update.rules.js
// Lista ordenada de reglas puras para updateInvoiceSchema.
// EL ORDEN REPLICA EL .custom() ORIGINAL — no reordenar.
// ============================================================

const { runRules } = require('../common/rule-runner');

const { issuedAt30dRule } = require('../rules/issued-at.rule');
const { itemsLineCoherenceUpdateRule } = require('../rules/items-line-coherence.rule');
const { itemRetencionRule } = require('../rules/item-retencion.rule');
const { dt35RangoUpdateRule } = require('../rules/dt35-rango-update.rule');
const { fechasRangoRule } = require('../rules/fechas-rango.rule');
const { tipoMonedaUpdateRule } = require('../rules/tipo-moneda.rule');
const { dt32SubtotalesUpdateRule } = require('../rules/dt32-subtotales.rule');
const { dt33NumeroLineaRule } = require('../rules/dt33-numerolinea.rule');
const { dt33Norma1007Rule } = require('../rules/dt33-norma1007.rule');
const { dt33TipoValorRule } = require('../rules/dt33-tipovalor.rule');

// ⚠️ ORDEN = orden de bloques del .custom() original de update.
const UPDATE_RULES = [
    issuedAt30dRule,              // bloque 1 (con 30d)
    itemsLineCoherenceUpdateRule, // bloques 2 + 4
    itemRetencionRule,            // bloque 3
    dt35RangoUpdateRule,          // DT35 rango 1-5
    fechasRangoRule,              // bloque 5
    tipoMonedaUpdateRule,         // bloque 6 (solo ≠DOP)
    dt32SubtotalesUpdateRule,     // DT32 (a + b parcial)
    dt33NumeroLineaRule,          // DT33 1
    dt33Norma1007Rule,            // DT33 2
    dt33TipoValorRule             // DT33 3
];

function applyUpdateRules(schema) {
    return schema
        .min(1)
        .messages({ 'object.min': 'At least one field is required to update' })
        .custom((value, helpers) => runRules(UPDATE_RULES, value, helpers))
        .messages({ 'any.custom': '{{#message}}' });
}

module.exports = { applyUpdateRules, UPDATE_RULES };