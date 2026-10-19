// ============================================================
// Servicio de productos (catálogo del POS interno)
// ============================================================
//
// Multi-tenant: TODAS las queries filtran por companyId
// (sacado del JWT en el controlador, nunca de la URL/body).
//
// Audit log en cada operación:
//   product.created | product.updated
//   product.activated | product.deactivated | product.deleted
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
    Company,
    Product,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Helper: crear audit log (best-effort, no rompe el flujo)
// ------------------------------------------------------------
async function createAuditLog({
    companyId,
    userId,
    action,
    entityId,
    before = null,
    after = null,
    reqInfo = {}
}) {
    try {
        await AuditLog.create({
            companyId,
            userId: userId ?? null,
            action,
            entity: 'product',
            entityId,
            before,
            after,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Nunca debe romper la operación principal
        console.error('[products.service] audit log failed:', err.message);
    }
}

// ------------------------------------------------------------
// Helper: validar itemCode único por empresa
// (defensa a nivel servicio; la BD tiene índice único parcial)
// ------------------------------------------------------------
async function assertItemCodeAvailable(companyId, itemCode, excludeProductId = null) {
    if (!itemCode) return;

    const where = {
        companyId,
        itemCode
    };
    if (excludeProductId) {
        where.id = { [Op.ne]: excludeProductId };
    }

    const existing = await Product.findOne({ where, attributes: ['id'] });
    if (existing) {
        throw new AppError(
            `itemCode "${itemCode}" is already used by another product in this company`,
            409,
            'DUPLICATE_ITEM_CODE'
        );
    }
}

// ------------------------------------------------------------
// Listar mis productos (company_admin + operator)
// ------------------------------------------------------------
async function listMyProducts(companyId, filters = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const where = { companyId };

    if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
    }

    if (filters.search) {
        const term = `%${filters.search}%`;
        where[Op.or] = [
            { name: { [Op.iLike]: term } },
            { itemCode: { [Op.iLike]: term } }
        ];
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await Product.findAndCountAll({
        where,
        order: [['name', 'ASC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items: rows,
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
// Ver un producto por ID (company_admin + operator)
// ------------------------------------------------------------
async function getMyProductById(companyId, productId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const product = await Product.findOne({
        where: { id: productId, companyId }
    });

    if (!product) {
        throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    return { product };
}

// ------------------------------------------------------------
// Crear producto (company_admin)
// ------------------------------------------------------------
async function createMyProduct(companyId, data, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Verificar empresa existe (consistencia con invoices.service)
    const company = await Company.findByPk(companyId, { attributes: ['id', 'isActive'] });
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
    if (!company.isActive) {
        throw new AppError(
            'Company is inactive. Cannot create products.',
            403,
            'COMPANY_INACTIVE'
        );
    }

    // 2. Validar itemCode único (si viene)
    await assertItemCodeAvailable(companyId, data.itemCode || null);

    // 3. Crear
    const product = await Product.create({
        companyId,
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        taxType: data.taxType,
        itemCode: data.itemCode || null,
        isActive: data.isActive !== undefined ? data.isActive : true
    });

    // 4. Audit
    await createAuditLog({
        companyId,
        userId: reqUser?.id,
        action: 'product.created',
        entityId: product.id,
        after: {
            name: product.name,
            price: Number(product.price),
            taxType: product.taxType,
            itemCode: product.itemCode || null,
            isActive: product.isActive
        },
        reqInfo
    });

    return { product };
}

// ------------------------------------------------------------
// Actualizar producto (company_admin)
// Solo campos editables: name, description, price, taxType,
// itemCode, isActive.
// ------------------------------------------------------------
async function updateMyProduct(companyId, productId, updates, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar producto (multi-tenant)
    const product = await Product.findOne({
        where: { id: productId, companyId }
    });

    if (!product) {
        throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // 2. Si cambia itemCode, validar unicidad
    if (updates.itemCode !== undefined) {
        await assertItemCodeAvailable(companyId, updates.itemCode || null, productId);
    }

    // 3. Guardar estado anterior para audit (solo los editables)
    const before = {
        name: product.name,
        description: product.description,
        price: Number(product.price),
        taxType: product.taxType,
        itemCode: product.itemCode,
        isActive: product.isActive
    };

    // 4. Construir el updateData con solo los campos presentes
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description ?? null;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.taxType !== undefined) updateData.taxType = updates.taxType;
    if (updates.itemCode !== undefined) updateData.itemCode = updates.itemCode || null;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    // 5. Update
    await product.update(updateData);

    // 6. Audit
    await createAuditLog({
        companyId,
        userId: reqUser?.id,
        action: 'product.updated',
        entityId: product.id,
        before,
        after: updateData,
        reqInfo
    });

    return { product };
}

// ------------------------------------------------------------
// Activar / desactivar producto (company_admin)
// ------------------------------------------------------------
async function toggleMyProductActive(companyId, productId, isActive, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const product = await Product.findOne({
        where: { id: productId, companyId }
    });

    if (!product) {
        throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // Si no cambia, no hacemos nada
    if (product.isActive === isActive) {
        return { product };
    }

    const before = { isActive: product.isActive };
    await product.update({ isActive });

    await createAuditLog({
        companyId,
        userId: reqUser?.id,
        action: isActive ? 'product.activated' : 'product.deactivated',
        entityId: product.id,
        before,
        after: { isActive },
        reqInfo
    });

    return { product };
}

// ------------------------------------------------------------
// Borrar producto (company_admin)
//
// Decisión:
//  - Hard delete SOLO si no tiene facturas asociadas.
//  - Si tiene facturas → 409 PRODUCT_HAS_INVOICES y sugerir desactivarlo.
//
// ¿Cómo sabemos si un producto tiene facturas asociadas?
// El POS traduce los productos a líneas de factura con `itemCode`
// copiado (snapshot). No hay FK directa products → invoice_lines.
// Pero sí podemos usar item_code como identificador estable:
//   - si el producto tiene itemCode: contamos invoice_lines con
//     el mismo itemCode en facturas de la empresa.
//   - si NO tiene itemCode: usamos su nombre como heurística
//     (más conservador: si hay líneas con el mismo description,
//     asumimos que pudo haberse usado).
// ------------------------------------------------------------
async function deleteMyProduct(companyId, productId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const product = await Product.findOne({
        where: { id: productId, companyId }
    });

    if (!product) {
        throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // Verificar si hay facturas asociadas (heurística estable)
    let invoiceUsage = 0;

    if (product.itemCode) {
        invoiceUsage = await InvoiceLine.count({
            where: { itemCode: product.itemCode },
            include: [{
                model: Invoice,
                as: 'invoice',
                where: { companyId },
                attributes: []
            }]
        });
    } else {
        // Fallback conservador: buscar por descripción exacta
        invoiceUsage = await InvoiceLine.count({
            where: { description: product.name },
            include: [{
                model: Invoice,
                as: 'invoice',
                where: { companyId },
                attributes: []
            }]
        });
    }

    if (invoiceUsage > 0) {
        throw new AppError(
            `Product has ${invoiceUsage} invoice line(s) associated. ` +
            `It cannot be deleted. Deactivate it instead.`,
            409,
            'PRODUCT_HAS_INVOICES'
        );
    }

    // Guardar antes para audit
    const before = {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        taxType: product.taxType,
        itemCode: product.itemCode,
        isActive: product.isActive
    };

    // Borrar en transacción (audit antes del destroy)
    await sequelize.transaction(async (t) => {
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'product.deleted',
                entity: 'product',
                entityId: product.id,
                before,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            console.error('[products.service] audit log (delete) failed:', err.message);
        }

        await product.destroy({ transaction: t });
    });

    return { deleted: true, before };
}

module.exports = {
    listMyProducts,
    getMyProductById,
    createMyProduct,
    updateMyProduct,
    toggleMyProductActive,
    deleteMyProduct
};