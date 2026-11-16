// ============================================================
// delete.service.js
// Borrar factura (company_admin).
// Solo si status === 'draft' y sin trackId.
// ============================================================

const sequelize = require('../../../config/database');
const { Invoice, AuditLog } = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Borrar factura (company_admin)
// Solo si status === 'draft' y sin trackId
// ------------------------------------------------------------
async function deleteMyInvoice(companyId, invoiceId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la factura
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId }
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Solo se puede borrar si está en draft
    if (invoice.status !== 'draft') {
        throw new AppError(
            `Cannot delete invoice with status '${invoice.status}'. Only drafts can be deleted.`,
            409,
            'INVOICE_NOT_DELETABLE'
        );
    }

    // 3. Si tiene trackId, ya fue enviada a DGII alguna vez
    if (invoice.trackId) {
        throw new AppError(
            'Cannot delete an invoice that has been sent to DGII. It has a TrackId.',
            409,
            'INVOICE_HAS_TRACKID'
        );
    }

    // 4. Guardar datos para audit ANTES del delete
    const before = {
        id: invoice.id,
        ncf: invoice.ncf,
        type: invoice.type,
        total: Number(invoice.total),
        status: invoice.status,
        receiverName: invoice.receiverName,
        issuedAt: invoice.issuedAt,
        modifiedNcf: invoice.modifiedNcf || null
    };

    // 5. Borrar en transacción
    await sequelize.transaction(async (t) => {
        // 5.1. Audit log ANTES del delete (para conservar entityId)
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.deleted',
                entity: 'invoice',
                entityId: invoice.id,
                before,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        // 5.2. Borrar la factura (CASCADE borra invoice_lines)
        await invoice.destroy({ transaction: t });
    });

    return {
        deleted: true,
        before,
        note: 'The NCF consumed by this invoice is NOT returned to the sequence. It remains consumed.'
    };
}

module.exports = { deleteMyInvoice };