// ============================================================
// create.rules.js
// Lista ordenada de reglas puras para createInvoiceSchema.
// EL ORDEN REPLICA EL .custom() ORIGINAL — no reordenar.
// ============================================================

const { runRules } = require('../common/rule-runner');

const { issuedAtRule } = require('../rules/issued-at.rule');
const { itemsLineCoherenceRule } = require('../rules/items-line-coherence.rule');
const { notaCreditoFechasRule } = require('../rules/nota-credito-fechas.rule');
const { compradorPorTipoRule } = require('../rules/comprador-por-tipo.rule');
const { tipo43SinCompradorRule } = require('../rules/tipo-43-sin-comprador.rule');
const { tipo46y47ExtranjeroRule } = require('../rules/tipo-46-47-extranjero.rule');
const { dt35CodigosRule } = require('../rules/dt35-codigos.rule');
const { dt35NcfFormatoRule } = require('../rules/dt35-ncf-formato.rule');
const { dt35Codigo5Rule } = require('../rules/dt35-codigo-5.rule');
const { retencionPorTipoRule } = require('../rules/retencion-por-tipo.rule');
const { indicadorForzadoPorTipoRule } = require('../rules/indicador-forzado-por-tipo.rule');
const { tipo47ServicioRule } = require('../rules/tipo-47-servicio.rule');
const { retencionExentoRule } = require('../rules/retencion-exento.rule');
const { tipo32MontoRule } = require('../rules/tipo-32-monto.rule');
const { fechasRangoRule } = require('../rules/fechas-rango.rule');
const { tipoPagoRule } = require('../rules/tipo-pago.rule');
const { tipoMonedaCreateRule } = require('../rules/tipo-moneda.rule');
const { tipo46PaisRule } = require('../rules/tipo-46-pais.rule');
const { dt32SubtotalesCreateRule } = require('../rules/dt32-subtotales.rule');
const { dt33NumeroLineaRule } = require('../rules/dt33-numerolinea.rule');
const { dt33TiposProhibidosRule } = require('../rules/dt33-tipos-prohibidos.rule');
const { dt33Norma1007Rule } = require('../rules/dt33-norma1007.rule');
const { dt33TipoValorRule } = require('../rules/dt33-tipovalor.rule');

// ⚠️ ORDEN = orden de bloques del .custom() original de create.
const CREATE_RULES = [
    issuedAtRule,                 // bloque 1
    itemsLineCoherenceRule,       // bloque 2 (2.a + 2.c + 2.d + 2.e + 2.f + 2.g)
    notaCreditoFechasRule,        // bloque 3
    compradorPorTipoRule,         // bloque 4
    tipo43SinCompradorRule,       // bloque 5
    tipo46y47ExtranjeroRule,      // bloque 6
    // bloque 7 está comentado en el original (no-op)
    dt35CodigosRule,              // DT35 bloques 1+2+3+4
    dt35NcfFormatoRule,           // DT35 bloque 6 (incluye console.log)
    dt35Codigo5Rule,              // DT35 bloque 7
    retencionPorTipoRule,         // DT31 bloques 8+9
    indicadorForzadoPorTipoRule,  // DT31 bloque 10
    tipo47ServicioRule,           // DT31 bloque 11
    retencionExentoRule,          // DT31 bloque 12
    tipo32MontoRule,              // bloque 13
    fechasRangoRule,              // DT30 fechaDesde/Hasta
    tipoPagoRule,                 // DT30 tipoPago (12+13)
    tipoMonedaCreateRule,         // DT30 tipoMoneda (14+15)
    tipo46PaisRule,               // bloque 16
    dt32SubtotalesCreateRule,     // DT32 (a+b+c+d)
    dt33NumeroLineaRule,          // DT33 1
    dt33TiposProhibidosRule,      // DT33 2
    dt33Norma1007Rule,            // DT33 3
    dt33TipoValorRule             // DT33 4
];

function applyCreateRules(schema) {
    return schema
        .custom((value, helpers) => runRules(CREATE_RULES, value, helpers))
        .messages({ 'any.custom': '{{#message}}' });
}

module.exports = { applyCreateRules, CREATE_RULES };