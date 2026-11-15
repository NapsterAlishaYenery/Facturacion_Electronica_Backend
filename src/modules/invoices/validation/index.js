const { invoiceIdParamsSchema } = require('./params/invoiceId.params');
const { listInvoicesQuerySchema } = require('./query/listInvoices.query');
const { listAllInvoicesQuerySchema } = require('./query/listAllInvoices.query');
const { downloadPDFQuerySchema } = require('./query/downloadPDF.query');
const { downloadXMLQuerySchema } = require('./query/downloadXML.query');
const { downloadRFCEQuerySchema } = require('./query/downloadRFCE.query');
const { itemSchema } = require('./schemas/item.schema');
const { subtotalSchema } = require('./schemas/subtotal.schema');
const { descuentoORecargoSchema } = require('./schemas/descuentoRecargo.schema');
const { transporteSchema } = require('./schemas/transporte.schema');
const { informacionesAdicionalesSchema } = require('./schemas/informacionesAdicionales.schema');
const { idDocExtrasSchema } = require('./schemas/idDocExtras.schema');
const { emisorExtrasSchema } = require('./schemas/emisorExtras.schema');
const { compradorExtrasSchema } = require('./schemas/compradorExtras.schema');
const { totalesExtrasSchema } = require('./schemas/totalesExtras.schema');
const { otraMonedaSchema } = require('./schemas/otraMoneda.schema');

module.exports = {
    invoiceIdParamsSchema,
    listInvoicesQuerySchema,
    listAllInvoicesQuerySchema,
    downloadPDFQuerySchema,
    downloadXMLQuerySchema,
    downloadRFCEQuerySchema,
    itemSchema,
    subtotalSchema,
    descuentoORecargoSchema,
    transporteSchema,
    informacionesAdicionalesSchema,
    idDocExtrasSchema,
    emisorExtrasSchema,
    compradorExtrasSchema,
    totalesExtrasSchema,
    otraMonedaSchema,
    // create/update se agregan en step 3 y 6
};