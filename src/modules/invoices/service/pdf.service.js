// ============================================================
// pdf.service.js
// Generar/obtener el PDF de una factura (company_admin).
// Cachea el PDF en disco por formato.
// ============================================================

const {
    Company,
    Invoice,
    InvoiceLine,
    InvoiceSubtotal,
    InvoiceDiscountCharge,
    CompanyLogo
} = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Generar/obtener el PDF de una factura (company_admin)
// Cachea el PDF en disco por formato.
// ------------------------------------------------------------
async function getMyInvoicePDF(companyId, invoiceId, format = 'a4') {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Validar formato
    const { normalizeFormat } = require('../../documents/pdf/pdf-generator');
    const normalizedFormat = normalizeFormat(format);

    // 2. Buscar la factura con relaciones
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        include: [
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
            },
            {
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity'],
                include: [{
                    model: CompanyLogo,
                    as: 'logos',
                    where: { purpose: 'invoice' },
                    required: false,
                    attributes: ['id', 'purpose', 'secureUrl', 'format', 'width', 'height']
                }]
            },
            {
                model: InvoiceSubtotal,
                as: 'subtotales',
                separate: true,
                order: [['numeroSubtotal', 'ASC']]
            },
            {
                model: InvoiceDiscountCharge,
                as: 'descuentosORecargos',
                separate: true,
                order: [['numeroLinea', 'ASC']]
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 3. Intentar leer del caché
    const { readPDFFromDisk, savePDFToDisk } = require('../../documents/storage/pdf-storage');

    let pdfBuffer = await readPDFFromDisk(invoice, normalizedFormat);

    if (!pdfBuffer) {
        // 4. Generar PDF
        const { generateInvoicePDF } = require('../../documents/pdf/pdf-generator');

        pdfBuffer = await generateInvoicePDF(
            invoice,
            invoice.lines,
            invoice.company,
            normalizedFormat
        );

        // 5. Guardar en disco (fire-and-forget)
        savePDFToDisk(invoice, pdfBuffer, normalizedFormat).catch(err => {
            console.error('[getMyInvoicePDF] savePDFToDisk failed:', err.message);
        });
    }

    return { buffer: pdfBuffer, ncf: invoice.ncf, format: normalizedFormat };
}

module.exports = { getMyInvoicePDF };