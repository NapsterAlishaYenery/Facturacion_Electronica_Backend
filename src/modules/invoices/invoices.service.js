// ============================================================
// invoices.service.js
// Punto de entrada del módulo de facturas.
// Re-exporta el árbol dividido en service/.
//
// El código real vive en:
//   - service/helpers/
//   - service/build/
//   - service/totals/
//   - service/ncf/
//   - service/list.service.js
//   - service/get.service.js
//   - service/create.service.js
//   - service/update.service.js
//   - service/delete.service.js
//   - service/pdf.service.js
//   - service/xml.service.js
//   - service/sign.service.js
//
// Este archivo existe para no tocar controller.js ni otros consumidores
// (incluyendo internalBilling que usa _helpers).
// ============================================================

module.exports = require('./service');