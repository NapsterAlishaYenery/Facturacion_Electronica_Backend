// ============================================================
// xml.service.js
// Obtener el XML de una factura y el XML del RFCE.
//   - getMyInvoiceXML      → xmlContent (unsigned) o xmlSigned (signed)
//   - getMyInvoiceRFCEXML  → rfce.xmlContent o rfce.xmlSigned
// ============================================================

const { Invoice, RfceDocument } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Obtener el XML de una factura (company_admin)
//
// type = 'unsigned' → invoice.xmlContent (default)
// type = 'signed'   → invoice.xmlSigned
//
// Devuelve { xml, ncf, type }
// ------------------------------------------------------------
async function getMyInvoiceXML(companyId, invoiceId, type = 'unsigned') {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Validar tipo
    if (type !== 'unsigned' && type !== 'signed') {
        throw new AppError(
            `Invalid XML type: ${type}. Must be "unsigned" or "signed".`,
            400,
            'INVALID_XML_TYPE'
        );
    }

    // 2. Buscar la factura (multi-tenant)
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        attributes: ['id', 'ncf', 'type', 'status', 'issuedAt', 'companyId', 'xmlContent', 'xmlSigned']
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 3. Determinar el contenido según el tipo
    const isSigned = type === 'signed';
    const xmlFromDb = isSigned ? invoice.xmlSigned : invoice.xmlContent;

    if (!xmlFromDb) {
        // No hay XML en BD
        if (isSigned) {
            throw new AppError(
                'Invoice has not been signed yet. Cannot download signed XML.',
                409,
                'INVOICE_NOT_SIGNED'
            );
        } else {
            throw new AppError(
                'Invoice has no XML generated yet. Try editing the invoice to regenerate it.',
                409,
                'XML_NOT_GENERATED'
            );
        }
    }

    // 4. Intentar leer del disco (fallback a BD)
    const { readXMLFromDisk } = require('../../documents/storage/xml-storage');

    let xml = await readXMLFromDisk(invoice, type);

    // Si el disco no lo tiene, usar el de BD
    if (!xml) {
        xml = xmlFromDb;
    }

    return {
        xml,
        ncf: invoice.ncf,
        type
    };
}

// ------------------------------------------------------------
// Obtener el XML del RFCE de una factura (company_admin)
//
// El RFCE solo existe para tipo 32 con total < 250,000.
// type = 'unsigned' → rfce.xmlContent (default)
// type = 'signed'   → rfce.xmlSigned
//
// Devuelve { xml, ncf, type }
// ------------------------------------------------------------
async function getMyInvoiceRFCEXML(companyId, invoiceId, type = 'unsigned') {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Validar tipo
    if (type !== 'unsigned' && type !== 'signed') {
        throw new AppError(
            `Invalid XML type: ${type}. Must be "unsigned" or "signed".`,
            400,
            'INVALID_XML_TYPE'
        );
    }

    // 2. Buscar la factura (multi-tenant) con su RFCE
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        attributes: ['id', 'ncf', 'type', 'status', 'total'],
        include: [{
            model: RfceDocument,
            as: 'rfce',
            required: false
        }]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 3. El RFCE solo aplica a tipo 32 con total < 250,000
    if (String(invoice.type) !== '32' || Number(invoice.total) >= 250000) {
        throw new AppError(
            `RFCE only applies to invoice type 32 with total < 250,000. ` +
            `This invoice is type ${invoice.type} with total ${invoice.total}.`,
            409,
            'RFCE_NOT_APPLICABLE'
        );
    }

    // 4. ¿Existe el RFCE?
    const rfce = invoice.rfce;
    if (!rfce) {
        throw new AppError(
            'RFCE has not been generated for this invoice yet. ' +
            'Try editing the invoice to regenerate it.',
            409,
            'RFCE_NOT_GENERATED'
        );
    }

    // 5. Determinar el contenido según el tipo
    const isSigned = type === 'signed';
    const xmlFromDb = isSigned ? rfce.xmlSigned : rfce.xmlContent;

    if (!xmlFromDb) {
        if (isSigned) {
            throw new AppError(
                'RFCE has not been signed yet. Cannot download signed RFCE XML.',
                409,
                'RFCE_NOT_SIGNED'
            );
        } else {
            throw new AppError(
                'RFCE has no XML content. Try editing the invoice to regenerate it.',
                409,
                'RFCE_XML_EMPTY'
            );
        }
    }

    // 6. Intentar leer del disco (fallback a BD)
    //    El archivo se guarda como "{ncf}-RFCE.xml" o "{ncf}-RFCE.signed.xml"
    const { readXMLFromDisk } = require('../../documents/storage/xml-storage');

    let xml = null;
    try {
        xml = await readXMLFromDisk(
            { ...invoice.toJSON(), ncf: `${invoice.ncf}-RFCE` },
            type
        );
    } catch (err) {
        // Si falla la lectura del disco, usar el de BD
        console.error('[getMyInvoiceRFCEXML] Disk read failed, using DB:', err.message);
    }

    if (!xml) {
        xml = xmlFromDb;
    }

    return {
        xml,
        ncf: invoice.ncf,
        type
    };
}

module.exports = {
    getMyInvoiceXML,
    getMyInvoiceRFCEXML
};