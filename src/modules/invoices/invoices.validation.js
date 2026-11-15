// ============================================================
// invoices.validation.js
// Punto de entrada del módulo de validaciones.
// Re-exporta el árbol dividido en validation/.
//
// El código real vive en:
//   - validation/params/
//   - validation/query/
//   - validation/schemas/
//   - validation/rules/
//   - validation/create/
//   - validation/update/
//
// Este archivo existe para no tocar routes.js/controller.js/service.js.
// ============================================================

module.exports = require('./validation');