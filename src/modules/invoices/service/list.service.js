// ============================================================
// list.service.js
// Listado de facturas:
//   - listMyInvoices  (company_admin, filtrado por companyId)
//   - listAllInvoices (admin, sin filtro de company)
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../../config/database');
const { Company, Sequence, Invoice, InvoiceLine } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');
const { buildInvoiceResponse } = require('./build/invoice-response.builder');

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

// ------------------------------------------------------------
// Listar TODAS las facturas (solo admin)
// ------------------------------------------------------------
async function listAllInvoices(filters = {}) {
    // Construir where
    const where = {};

    if (filters.companyId) {
        where.companyId = filters.companyId;
    }

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

    // Include de Company (con filtro por search si aplica)
    const companyInclude = {
        model: Company,
        as: 'company',
        attributes: ['id', 'rnc', 'name', 'isActive']
    };

    if (filters.search) {
        companyInclude.where = {
            [Op.or]: [
                { rnc: { [Op.iLike]: `%${filters.search}%` } },
                { name: { [Op.iLike]: `%${filters.search}%` } }
            ]
        };

        companyInclude.required = true; // INNER JOIN
    }

    // Query con include de company y sequence
    const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [
            companyInclude,
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber']
            }
        ],
        order: [['issuedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    // Contar líneas de cada factura (una sola query agrupada)
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
    listMyInvoices,
    listAllInvoices
};