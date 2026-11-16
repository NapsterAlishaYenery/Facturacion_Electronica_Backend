// ============================================================
// sign.service.js
// Firmar factura (company_admin).
// Solo drafts, con xmlContent generado.
//
// Flujo:
//   1. Firmar e-CF → xmlSigned + status='signed'
//   2. Si type=32 y total<250K: regenerar RFCE con securityCode real
//      y firmar el RFCE
//   3. Guardar ambos en disco
//   4. Audit log
// ============================================================

const { Company, Invoice, InvoiceLine, RfceDocument, AuditLog } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Firmar factura (company_admin)
// ------------------------------------------------------------
async function signMyInvoice(companyId, invoiceId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Cargar invoice + company + líneas + RFCE si existe
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        include: [
            { model: Company, as: 'company' },
            { model: InvoiceLine, as: 'lines', separate: true, order: [['lineNumber', 'ASC']] },
            { model: RfceDocument, as: 'rfce', required: false }
        ]
    });

    if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    if (invoice.status !== 'draft') {
        throw new AppError(
            `Cannot sign invoice with status '${invoice.status}'. Only drafts can be signed.`,
            409,
            'INVOICE_NOT_SIGNABLE'
        );
    }
    if (!invoice.xmlContent) {
        throw new AppError('Invoice has no XML content.', 409, 'XML_NOT_GENERATED');
    }
    if (!invoice.company || !invoice.company.certificatePath) {
        throw new AppError(
            'Company has no certificate uploaded.',
            409,
            'COMPANY_NO_CERTIFICATE'
        );
    }

    // 2. Firmar el e-CF
    const { signInvoiceXml } = require('../../documents/sign');

    let signResult;
    try {
        signResult = await signInvoiceXml(invoice.xmlContent, invoice.company);
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
            `Failed to sign invoice: ${err.message}`,
            500,
            'INVOICE_SIGN_FAILED'
        );
    }

    const { xmlSigned, fechaHoraFirma, securityCode, signedAt } = signResult;

    // 3. Guardar e-CF firmado
    await invoice.update({
        xmlSigned,
        status: 'signed'
    });

    // 4. Si aplica RFCE: regenerar con securityCode real y firmar
    let rfceResult = null;
    const totalNum = Number(invoice.total);
    const isRFCE = String(invoice.type) === '32' && totalNum < 250000;

    if (isRFCE) {
        try {
            const { generateAndSaveRFCE } = require('../../documents/xml/xml-integrator');

            // 4.1. Regenerar RFCE con el securityCode del e-CF 32 firmado
            const rfceRow = await generateAndSaveRFCE(invoice.id, securityCode, null);

            if (rfceRow && rfceRow.xmlContent) {
                // 4.2. Firmar el RFCE (sin <FechaHoraFirma>)
                const rfceSign = await signInvoiceXml(rfceRow.xmlContent, invoice.company);
                await rfceRow.update({
                    xmlSigned: rfceSign.xmlSigned,
                    status: 'signed'
                });
                rfceResult = {
                    signed: true,
                    securityCode
                };
            }
        } catch (rfceErr) {
            console.error('[signMyInvoice] RFCE signing failed:', rfceErr.message);
            rfceResult = {
                signed: false,
                error: rfceErr.message
            };
        }
    }

    // 5. Guardar en disco (fire-and-forget)
    try {
        const { saveSignedXMLToDisk } = require('../../documents/storage/xml-storage');
        saveSignedXMLToDisk(invoice, xmlSigned).catch(err => {
            console.error('[signMyInvoice] saveSignedXMLToDisk failed:', err.message);
        });
    } catch (err) {
        console.error('[signMyInvoice] Disk storage module error:', err.message);
    }

    // 6. Audit log
    try {
        await AuditLog.create({
            companyId,
            userId: reqUser?.id ?? null,
            action: 'invoice.signed',
            entity: 'invoice',
            entityId: invoice.id,
            before: { status: 'draft' },
            after: {
                status: 'signed',
                fechaHoraFirma,
                securityCode,
                certRnc: invoice.company.rnc,
                rfceSigned: rfceResult ? rfceResult.signed : false
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) { /* silencioso */ }

    // 7. Respuesta
    return {
        invoice: {
            id: invoice.id,
            ncf: invoice.ncf,
            type: invoice.type,
            status: 'signed',
            fechaHoraFirma,
            signedAt: signedAt.toISOString(),
            securityCode,
            xmlSignedLength: xmlSigned.length
        },
        rfce: rfceResult
    };
}

module.exports = { signMyInvoice };