const { createInvoiceSchemaBase } = require('./create.schema');
const { applyCreateRules } = require('./create.rules');

const createInvoiceSchema = applyCreateRules(createInvoiceSchemaBase);

module.exports = { createInvoiceSchema };