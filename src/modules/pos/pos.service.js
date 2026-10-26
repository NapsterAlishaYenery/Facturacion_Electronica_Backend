// ============================================================
// Servicio del POS (facturación rápida)
// ============================================================
//
// El POS SOLO emite 31 y 32 (MVP). Traduce items del POS a
// líneas fiscales con TODOS los campos DGII, valida el payload
// uniforme con createInvoiceSchema y delega a createMyInvoice.
//
// Multi-tenant: companyId viene del JWT (controlador).
// ============================================================

const { Product } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');
const invoicesService = require('../invoices/invoices.service');
const { createInvoiceSchema } = require('../invoices/invoices.validation');

// ------------------------------------------------------------
// TAX_MAP: taxType → { itbisRate, indicadorFacturacion }
// (sin ITBIS_3 porque el POS solo emite 31 y 32)
// ------------------------------------------------------------
const TAX_MAP = {
    ITBIS_18: { itbisRate: 18, indicadorFacturacion: 1 },
    ITBIS_16: { itbisRate: 16, indicadorFacturacion: 2 },
    EXENTO: { itbisRate: 0, indicadorFacturacion: 4 }
};

// ------------------------------------------------------------
// Helper: resolver un ítem de catálogo contra la BD
// Trae TODOS los campos DGII del producto
// ------------------------------------------------------------
async function resolveCatalogItem(companyId, item) {
    const product = await Product.findOne({
        where: {
            id: item.productId,
            companyId,
            isActive: true
        }
    });

    if (!product) {
        throw new AppError(
            `Product not found or inactive: ${item.productId}`,
            404,
            'PRODUCT_NOT_FOUND'
        );
    }

    // 🔥 NUEVO: si el producto es Bien pero no tiene unidadMedida,
    // es data legacy inconsistente. Fallamos claro en lugar de que
    // Joi reviente con "unidadMedida is required" más abajo.
    if (product.indicadorBienoServicio === 1 && !product.unidadMedida) {
        throw new AppError(
            `Product ${product.id} ("${product.name}") is a Bien but has no unidadMedida. ` +
            `Edit the product to add a DGII unit code (1-62) before using it in POS.`,
            409,
            'PRODUCT_MISSING_UNIDAD_MEDIDA'
        );
    }

    const tax = TAX_MAP[product.taxType];
    if (!tax) {
        throw new AppError(
            `Product ${product.id} has unsupported taxType: ${product.taxType}. ` +
            `POS only supports ITBIS_18, ITBIS_16, EXENTO.`,
            409,
            'UNSUPPORTED_TAX_TYPE'
        );
    }

    return {
        itemCode: product.itemCode || null,
        itemName: product.name,
        description: product.description || null,
        indicadorBienoServicio: product.indicadorBienoServicio,
        unidadMedida: product.unidadMedida,
        quantity: Number(item.quantity),
        unitPrice: Number(product.price),
        discount: 0,
        recargo: 0,
        cantidadReferencia: product.cantidadReferencia !== null
            ? Number(product.cantidadReferencia) : null,
        unidadReferencia: product.unidadReferencia,
        gradosAlcohol: product.gradosAlcohol !== null
            ? Number(product.gradosAlcohol) : null,
        precioUnitarioReferencia: product.precioUnitarioReferencia !== null
            ? Number(product.precioUnitarioReferencia) : null,
        fechaElaboracion: product.fechaElaboracion,
        fechaVencimientoItem: product.fechaVencimientoItem,
        itbisRate: tax.itbisRate,
        indicadorFacturacion: tax.indicadorFacturacion
    };
}

// ------------------------------------------------------------
// Helper: traducir un ítem manual a línea fiscal
// Propaga TODOS los campos DGII del body
// ------------------------------------------------------------
function resolveManualItem(item) {
    let itbisRate;
    let indicadorFacturacion;

    if (item.taxType) {
        const tax = TAX_MAP[item.taxType];
        if (!tax) {
            throw new AppError(
                `Invalid taxType for POS: ${item.taxType}`,
                400,
                'INVALID_TAX_TYPE'
            );
        }
        itbisRate = tax.itbisRate;
        indicadorFacturacion = tax.indicadorFacturacion;
    } else {
        itbisRate = item.itbisRate !== undefined ? Number(item.itbisRate) : 18;
        indicadorFacturacion = item.indicadorFacturacion !== undefined
            ? Number(item.indicadorFacturacion)
            : undefined;
    }

    return {
        itemCode: item.itemCode || null,
        itemName: item.itemName,
        description: item.description || null,
        indicadorBienoServicio: item.indicadorBienoServicio,
        unidadMedida: item.unidadMedida ?? null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        recargo: Number(item.recargo || 0),
        cantidadReferencia: item.cantidadReferencia ?? null,
        unidadReferencia: item.unidadReferencia ?? null,
        gradosAlcohol: item.gradosAlcohol ?? null,
        precioUnitarioReferencia: item.precioUnitarioReferencia ?? null,
        fechaElaboracion: item.fechaElaboracion ?? null,
        fechaVencimientoItem: item.fechaVencimientoItem ?? null,
        itbisRate,
        indicadorFacturacion

        // 🔥 ELIMINADO: if (item.retencion) { resolved.retencion = item.retencion; }
        // El POS no emite 41/47, así que retencion nunca debe llegar aquí.
    };
}

// ------------------------------------------------------------
// Helper: calcular el total estimado
// ------------------------------------------------------------
function estimateTotal(fiscalItems) {
    return fiscalItems.reduce((sum, it) => {
        const base = (it.quantity * it.unitPrice)
            - (it.discount || 0)
            + (it.recargo || 0);
        const rate = it.itbisRate ?? 18;
        const itbis = base * (rate / 100);
        return sum + base + itbis;
    }, 0);
}

// ------------------------------------------------------------
// Crear factura rápida (POS)
// ------------------------------------------------------------
async function createQuickInvoice(companyId, data, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const { type, receiverRnc, receiverName, issuedAt, items } = data;

    // 1. Traducir items a líneas fiscales
    const fiscalItems = [];
    for (const item of items) {
        if (item.productId) {
            fiscalItems.push(await resolveCatalogItem(companyId, item));
        } else {
            fiscalItems.push(resolveManualItem(item));
        }
    }

    // 2. Pre-validaciones de alto nivel
    if (type === '31') {
        if (!receiverRnc) {
            throw new AppError(
                'Type 31 requires receiverRnc',
                400,
                'VALIDATION_ERROR',
                [{ field: 'receiverRnc', message: 'receiverRnc is required for type 31' }]
            );
        }
        if (!receiverName) {
            throw new AppError(
                'Type 31 requires receiverName',
                400,
                'VALIDATION_ERROR',
                [{ field: 'receiverName', message: 'receiverName is required for type 31' }]
            );
        }
    }

    if (type === '32') {
        const total = estimateTotal(fiscalItems);
        if (total >= 250000) {
            const details = [];
            if (!receiverRnc) details.push({
                field: 'receiverRnc',
                message: 'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)'
            });
            if (!receiverName) details.push({
                field: 'receiverName',
                message: 'Type 32 with total >= 250,000 requires receiverName (DGII rule)'
            });
            if (details.length > 0) {
                throw new AppError(
                    'Validation failed for type 32 (DGII rule)',
                    400,
                    'VALIDATION_ERROR',
                    details
                );
            }
        }
    }

    // 3. Componer el payload uniforme
    const payload = {
        type,
        receiverRnc: receiverRnc || null,
        receiverName: receiverName || null,
        items: fiscalItems
    };

    if (issuedAt) payload.issuedAt = issuedAt;

    // 4. Validación fina fiscal (createInvoiceSchema es la fuente de verdad)
    const { error, value: validatedPayload } = createInvoiceSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
    });

    if (error) {
        const details = error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message,
            type: d.type
        }));

        throw new AppError(
            'Validation failed',
            400,
            'VALIDATION_ERROR',
            details
        );
    }

    // 5. Delegar a createMyInvoice
    const result = await invoicesService.createMyInvoice(
        companyId,
        validatedPayload,
        reqUser,
        reqInfo
    );

    return result;
}

module.exports = {
    createQuickInvoice,
    TAX_MAP,
    _helpers: {
        resolveCatalogItem,
        resolveManualItem,
        estimateTotal
    }
};