// ============================================================
// Servicio de facturas
// Pendiente: agregar funciones cuando se implementen los endpoints
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
    Company,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Helper: construir la respuesta completa de una factura
// con campos calculados
// ------------------------------------------------------------
function buildInvoiceResponse(invoice, options = {}) {
    const { lineCount = null } = options;

    const data = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;

    const status = data.status;

    const response = {
        ...data,
        isDraft: status === 'draft',
        isSigned: status === 'signed',
        isSent: status === 'sent',
        isAccepted: status === 'accepted',
        isRejected: status === 'rejected',
        isContingency: status === 'contingency',
        canEdit: status === 'draft',
        canDelete: status === 'draft',
        hasTrackId: !!data.trackId
    };

    // lineCount solo si se pasa explícitamente (viene de un COUNT)
    if (lineCount !== null) {
        response.lineCount = lineCount;
    }

    // Ocultar xmlContent y xmlSigned en listados (son pesados)
    // Se devuelven solo en el detalle individual
    if (options.hideXml !== false) {
        delete response.xmlContent;
        delete response.xmlSigned;
    }

    return { invoice: response };
}

// ------------------------------------------------------------
// Listar MIS facturas (company_admin)
// ------------------------------------------------------------
async function listMyInvoices(companyId, filters = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // Construir where
    const where = { companyId };

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.receiverRnc) {
        where.receiverRnc = filters.receiverRnc;
    }

    if (filters.ncf) {
        where.ncf = filters.ncf;
    }

    // Filtro por fecha de emisión
    if (filters.fromDate || filters.toDate) {
        where.issuedAt = {};
        if (filters.fromDate) {
            where.issuedAt[Op.gte] = filters.fromDate;
        }
        if (filters.toDate) {
            where.issuedAt[Op.lte] = filters.toDate;
        }
    }

    // Filtro por hasTrackId
    if (filters.hasTrackId !== undefined) {
        if (filters.hasTrackId === true) {
            where.trackId = { [Op.ne]: null };
        } else {
            where.trackId = { [Op.eq]: null };
        }
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Query con include de sequence
    const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [{
            model: Sequence,
            as: 'sequence',
            attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber']
        }],
        order: [['issuedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    // Para cada factura, contar sus líneas
    const invoiceIds = rows.map(r => r.id);
    let lineCounts = {};

    if (invoiceIds.length > 0) {
        const counts = await InvoiceLine.findAll({
            attributes: [
                'invoiceId',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: { invoiceId: { [Op.in]: invoiceIds } },
            group: ['invoiceId'],
            raw: true
        });
        counts.forEach(c => {
            lineCounts[c.invoiceId] = Number(c.count);
        });
    }

    // Enriquecer cada factura
    const items = rows.map((inv) => {
        const result = buildInvoiceResponse(inv, { lineCount: lineCounts[inv.id] || 0 });
        return result.invoice;
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items,
        pagination: {
            page,
            limit,
            totalItems: count,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

module.exports = {
    listMyInvoices
};


// Funciones planeadas:
// - listMyInvoices (company_admin)
// - getMyInvoiceById (company_admin)
// - createMyInvoice (company_admin)
// - updateMyInvoice (company_admin)
// - deleteMyInvoice (company_admin)
// - addLineToMyInvoice (company_admin)
// - updateLineOfMyInvoice (company_admin)
// - deleteLineOfMyInvoice (company_admin)
// - listAllInvoices (admin)
// - getInvoiceById (admin)

// Helpers internos:
// - buildInvoiceResponse
// - calculateInvoiceTotals
// - assignSequenceNumber (transaccional)
// - updateSequenceCurrentNumber
