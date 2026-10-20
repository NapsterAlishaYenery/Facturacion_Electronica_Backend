// ============================================================
// Servicio del POS (facturación rápida)
// ============================================================
//
// El POS es un "shape reducido + traducción" del endpoint
// POST /api/invoices/me. NO reimplementa facturación:
//
//   1. Traduce items del POS (productId + taxType) a líneas fiscales
//      (itemCode + description + quantity + unitPrice + itbisRate +
//       indicadorFacturacion + retencion).
//   2. Compone el payload uniforme (mismo shape que createInvoiceSchema).
//   3. Valida el payload con createInvoiceSchema (fuente de verdad
//      fiscal; cero duplicación de reglas).
//   4. Delega a invoicesService.createMyInvoice.
//
// Multi-tenant: companyId viene del JWT (controlador), nunca del body.
// ============================================================

const { Product } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');
const invoicesService = require('../invoices/invoices.service');
const { createInvoiceSchema } = require('../invoices/invoices.validation');

// ------------------------------------------------------------
// TAX_MAP: traducción de taxType del POS a los campos fiscales
// que consume createMyInvoice.
//
// Los 4 tratamientos de ITBIS:
//   - ITBIS_18  → indicador 1 (18% general)
//   - ITBIS_16  → indicador 2 (16% reducido)
//   - ITBIS_3   → indicador 3 (0% gravado / exportaciones,
//                 exclusivo tipo 46; createInvoiceSchema lo
//                 re-valida contra el tipo real)
//   - EXENTO    → indicador 4 (exento)
// ------------------------------------------------------------
const TAX_MAP = {
    ITBIS_18: { itbisRate: 18, indicadorFacturacion: 1 },
    ITBIS_16: { itbisRate: 16, indicadorFacturacion: 2 },
    ITBIS_3:  { itbisRate: 0,  indicadorFacturacion: 3 },
    EXENTO:   { itbisRate: 0,  indicadorFacturacion: 4 }
};

// ------------------------------------------------------------
// Helper: resolver un ítem de catálogo contra la BD
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

    const tax = TAX_MAP[product.taxType];
    if (!tax) {
        throw new AppError(
            `Product ${product.id} has unsupported taxType: ${product.taxType}`,
            409,
            'UNSUPPORTED_TAX_TYPE'
        );
    }

    return {
        itemCode: product.itemCode || null,
        description: product.name,
        quantity: Number(item.quantity),
        unitPrice: Number(product.price),
        discount: 0,
        itbisRate: tax.itbisRate,
        indicadorFacturacion: tax.indicadorFacturacion
    };
}

// ------------------------------------------------------------
// Helper: traducir un ítem manual a línea fiscal
//
// Si viene taxType → traducir con TAX_MAP.
// Si NO viene taxType pero sí itbisRate/indicadorFacturacion
//   → respetarlos tal cual (compatibilidad con shape de
//     createInvoiceSchema).
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
        // Modo "compatibilidad": el cliente ya mandó los campos fiscales
        itbisRate = item.itbisRate !== undefined ? Number(item.itbisRate) : 18;
        indicadorFacturacion = item.indicadorFacturacion !== undefined
            ? Number(item.indicadorFacturacion)
            : undefined;
    }

    const resolved = {
        itemCode: item.itemCode || null,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        itbisRate,
        indicadorFacturacion
    };

    if (item.retencion) {
        resolved.retencion = item.retencion;
    }

    return resolved;
}

// ------------------------------------------------------------
// Helper: calcular el total estimado de las líneas fiscales
// ------------------------------------------------------------
function estimateTotal(fiscalItems) {
    return fiscalItems.reduce((sum, it) => {
        const base = (it.quantity * it.unitPrice) - (it.discount || 0);
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

    const {
        type,
        receiverRnc,
        receiverName,
        issuedAt,
        items,
        // Campos opcionales por tipo (se pasan tal cual a createMyInvoice)
        receiverIdentificadorExtranjero,
        receiverPais,
        exemptAmount,
        itbis3Base,
        itbis3Amount,
        totalItbisRetenido,
        totalIsrRetencion,
        transporte,
        informacionesAdicionales,
        modifiedNcf,
        modifiedNcfIssuerRnc,
        modifiedNcfDate,
        modificationCode,
        modificationReason,
        indicadorNotaCredito
    } = data;

    // 1. Traducir items a líneas fiscales (uniforme)
    const fiscalItems = [];
    for (const item of items) {
        if (item.productId) {
            fiscalItems.push(await resolveCatalogItem(companyId, item));
        } else {
            fiscalItems.push(resolveManualItem(item));
        }
    }

    // 2. Pre-validaciones de alto nivel (fallan rápido con mensajes
    //    claros antes de molestar a createMyInvoice)
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

    // 3. Componer el payload uniforme (mismo shape que createInvoiceSchema)
    const payload = {
        type,
        receiverRnc: receiverRnc || null,
        receiverName: receiverName || null,
        items: fiscalItems
    };

    // Añadir campos opcionales SOLO si vienen (para no ensuciar el payload)
    if (issuedAt) payload.issuedAt = issuedAt;
    if (receiverIdentificadorExtranjero) payload.receiverIdentificadorExtranjero = receiverIdentificadorExtranjero;
    if (receiverPais) payload.receiverPais = receiverPais;
    if (exemptAmount !== undefined) payload.exemptAmount = exemptAmount;
    if (itbis3Base !== undefined) payload.itbis3Base = itbis3Base;
    if (itbis3Amount !== undefined) payload.itbis3Amount = itbis3Amount;
    if (totalItbisRetenido !== undefined) payload.totalItbisRetenido = totalItbisRetenido;
    if (totalIsrRetencion !== undefined) payload.totalIsrRetencion = totalIsrRetencion;
    if (transporte) payload.transporte = transporte;
    if (informacionesAdicionales) payload.informacionesAdicionales = informacionesAdicionales;
    if (modifiedNcf) payload.modifiedNcf = modifiedNcf;
    if (modifiedNcfIssuerRnc) payload.modifiedNcfIssuerRnc = modifiedNcfIssuerRnc;
    if (modifiedNcfDate) payload.modifiedNcfDate = modifiedNcfDate;
    if (modificationCode !== undefined) payload.modificationCode = modificationCode;
    if (modificationReason !== undefined) payload.modificationReason = modificationReason;
    if (indicadorNotaCredito !== undefined) payload.indicadorNotaCredito = indicadorNotaCredito;

    // 4. Validación fina fiscal: createInvoiceSchema es la fuente de verdad.
    //    Aplica las reglas DGII por tipo (transporte, info adicional,
    //    retención por línea, ITBIS3, modifiedNcf, coherencia
    //    indicador↔itbisRate, etc.).
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

    // 5. Delegar a createMyInvoice (reutiliza TODA la lógica fiscal:
    //    NCF, cálculo de totales, XML, audit, suscripción, etc.)
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