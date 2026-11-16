// ============================================================
// get.service.js
// Obtener una factura específica:
//   - getMyInvoiceById  (company_admin, filtra por companyId)
//   - getInvoiceById    (admin, sin filtro de company)
// ============================================================

const {
    Company,
    Sequence,
    Invoice,
    InvoiceLine,
    InvoiceSubtotal,
    InvoiceDiscountCharge,
    RfceDocument
} = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');
const { buildInvoiceResponse } = require('./build/invoice-response.builder');

// ------------------------------------------------------------
// Ver una factura específica (company_admin)
// ------------------------------------------------------------
async function getMyInvoiceById(companyId, invoiceId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la factura con sus relaciones
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        include: [
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,           // ← query separada para poder ordenar
                order: [['lineNumber', 'ASC']]
            },
            {
                model: RfceDocument,
                as: 'rfce',
                required: false
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Contar líneas (para lineCount)
    const lineCount = invoice.lines?.length || 0;

    // 3. Construir respuesta (SÍ exponer xmlContent y xmlSigned en detalle)
    const result = buildInvoiceResponse(invoice, {
        lineCount,
        hideXml: false  // ← en detalle SÍ mostramos XML
    });

    return result;
}

// ------------------------------------------------------------
// Ver CUALQUIER factura (solo admin)
// ------------------------------------------------------------
async function getInvoiceById(invoiceId) {
    // 1. Buscar la factura SIN filtrar por companyId
    const invoice = await Invoice.findByPk(invoiceId, {
        include: [
            {
                model: Company,
                as: 'company',
                attributes: [
                    'id', 'rnc', 'name', 'tradeName',
                    'email', 'phone', 'address', 'economicActivity',
                    'dgiiEnvironment', 'isActive',
                    'provinceDgiiCode', 'municipalityDgiiCode',
                    'sucursal', 'website', 'additionalPhones'
                ]
            },
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
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
            },
            {
                model: RfceDocument,
                as: 'rfce',
                required: false
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Contar líneas
    const lineCount = invoice.lines?.length || 0;

    // 3. Construir respuesta (SÍ exponer XML en detalle de admin)
    return buildInvoiceResponse(invoice, {
        lineCount,
        hideXml: false
    });
}

module.exports = {
    getMyInvoiceById,
    getInvoiceById
};