const { updateInvoiceSchemaBase } = require('./update.schema');
const { applyUpdateRules } = require('./update.rules');

const updateInvoiceSchema = applyUpdateRules(updateInvoiceSchemaBase);

module.exports = { updateInvoiceSchema };