// ============================================================
// update.service.js
// Editar factura (company_admin).
// Solo si status === 'draft'.
// Los campos de referencia de Notas (modifiedNcf, etc.) NO se
// pueden modificar — si intentan, la constraint del modelo falla.
//
// Este archivo solo ORQUESTA. La aritmética pesada vive en
// service/totals/*. La lógica es idéntica al service original.
// ============================================================

const sequelize = require('../../../config/database');
const {
    Sequence,
    Invoice,
    InvoiceLine,
    InvoiceSubtotal,
    InvoiceDiscountCharge,
    RfceDocument,
    AuditLog
} = require('../../../models');
const { AppError } = require('../../../shared/middlewares/error.middleware');

const { roundMoney } = require('./helpers/round');
const { buildInvoiceResponse } = require('./build/invoice-response.builder');
const { calculateLineTotals } = require('./build/invoice-lines.builder');
const { calculateInvoiceTotals } = require('./totals/invoice-totals');
const { calculateSubtotalsFromLines, assertSubtotalsMatchInvoiceTotal } = require('./totals/subtotals');
const { calculateOtraMonedaTotals } = require('./totals/otra-moneda');
const {
    prepareDescuentos,
    applyDescuentosToTotals,
    calculateValorPagarNorma1007,
    resolveDescuentoMonto
} = require('./totals/descuentos');

// ------------------------------------------------------------
// Editar factura (company_admin)
// ------------------------------------------------------------
async function updateMyInvoice(companyId, invoiceId, updates, reqUser, reqInfo = {}) {
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

    // 2. Solo se puede editar si está en draft
    if (invoice.status !== 'draft') {
        throw new AppError(
            `Cannot edit invoice with status '${invoice.status}'. Only drafts can be edited.`,
            409,
            'INVOICE_NOT_EDITABLE'
        );
    }

    // A) Retención por línea: solo 41/47, y obligatoria en ellos
    if (updates.items !== undefined) {
        const allowsRetencion = invoice.type === '41' || invoice.type === '47';

        for (let i = 0; i < updates.items.length; i++) {
            const ret = updates.items[i].retencion;
            const hasRetencion = ret !== undefined && ret !== null;

            if (hasRetencion && !allowsRetencion) {
                throw new AppError(
                    `Item ${i + 1}: retencion only applies to types 41 and 47`,
                    409,
                    'RETENCION_NOT_ALLOWED'
                );
            }
            if (allowsRetencion && !hasRetencion) {
                throw new AppError(
                    `Item ${i + 1}: retencion is required for types 41 and 47`,
                    409,
                    'RETENCION_REQUIRED'
                );
            }
        }
    }

    // DT31 — Validaciones por tipo al actualizar items
    if (updates.items !== undefined) {
        const tiposConRetencion = ['31', '33', '34', '41', '47'];
        const tiposQueExigenRetencion = ['41', '47'];

        for (let i = 0; i < updates.items.length; i++) {
            const item = updates.items[i];
            const hasRetencion = item.retencion !== undefined && item.retencion !== null;

            if (hasRetencion && !tiposConRetencion.includes(invoice.type)) {
                throw new AppError(
                    `Item ${i + 1}: retencion only applies to types 31, 33, 34, 41 and 47`,
                    409,
                    'RETENCION_NOT_ALLOWED'
                );
            }
            if (!hasRetencion && tiposQueExigenRetencion.includes(invoice.type)) {
                throw new AppError(
                    `Item ${i + 1}: retencion is required for types 41 and 47`,
                    409,
                    'RETENCION_REQUIRED'
                );
            }
        }

        if (['43', '44', '47'].includes(invoice.type)) {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorFacturacion ?? 4);
                if (ind !== 4) {
                    throw new AppError(
                        `Item ${i + 1}: type ${invoice.type} requires indicadorFacturacion=4 (Exento)`,
                        409,
                        'INDICADOR_FACTURACION_FORZADO'
                    );
                }
            }
        }
        if (invoice.type === '46') {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorFacturacion ?? 4);
                if (ind !== 3) {
                    throw new AppError(
                        `Item ${i + 1}: type 46 requires indicadorFacturacion=3 (ITBIS 0%)`,
                        409,
                        'INDICADOR_FACTURACION_FORZADO'
                    );
                }
            }
        }
        if (invoice.type === '47') {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorBienoServicio ?? 1);
                if (ind !== 2) {
                    throw new AppError(
                        `Item ${i + 1}: type 47 requires indicadorBienoServicio=2 (Servicio)`,
                        409,
                        'INDICADOR_BIENO_SERVICIO_FORZADO'
                    );
                }
            }
        }
    }

    // B) e-CF 32: si el total final >= 250,000 requiere identificación
    if (invoice.type === '32') {
        const finalItems = updates.items !== undefined
            ? updates.items
            : await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']]
            });

        const finalTotal = finalItems.reduce((sum, it) => {
            const base = (Number(it.quantity) * Number(it.unitPrice))
                - Number(it.discount || 0)
                + Number(it.recargo || 0);
            const itbis = base * (Number(it.itbisRate ?? 18) / 100);
            return sum + base + itbis;
        }, 0);

        const finalRnc = updates.receiverRnc !== undefined
            ? updates.receiverRnc
            : invoice.receiverRnc;

        const finalName = updates.receiverName !== undefined
            ? updates.receiverName
            : invoice.receiverName;

        if (finalTotal >= 250000) {
            if (!finalRnc) {
                throw new AppError(
                    `Type 32 with total >= 250,000 requires receiverRnc (DGII rule). Current total: ${finalTotal}`,
                    409,
                    'DGII_250K_RNC_REQUIRED'
                );
            }
            if (!finalName) {
                throw new AppError(
                    `Type 32 with total >= 250,000 requires receiverName (DGII rule). Current total: ${finalTotal}`,
                    409,
                    'DGII_250K_NAME_REQUIRED'
                );
            }
        }
    }

    // 3. Snapshot antes para audit
    const before = {
        receiverRnc: invoice.receiverRnc,
        receiverName: invoice.receiverName,
        issuedAt: invoice.issuedAt,
        subtotal: invoice.subtotal,
        itbis: invoice.itbis,
        total: invoice.total,
        modificationCode: invoice.modificationCode,
        modificationReason: invoice.modificationReason,
        tipoPago: invoice.tipoPago,
        tipoIngresos: invoice.tipoIngresos,
        codigoVendedor: invoice.codigoVendedor,
        terminoPago: invoice.terminoPago,
        tipoMoneda: invoice.tipoMoneda,
        tipoCambio: invoice.tipoCambio,
        descuentosCount: null,
        descuentosTotal: null
    };

    try {
        const currentDescuentos = await InvoiceDiscountCharge.findAll({
            where: { invoiceId: invoice.id }
        });
        before.descuentosCount = currentDescuentos.length;
        before.descuentosTotal = roundMoney(
            currentDescuentos.reduce((sum, d) => sum + Number(d.monto || 0), 0)
        );
    } catch (err) {
        console.error('[updateMyInvoice] Failed to load current descuentos for audit:', err.message);
    }

    // 4. Transacción
    const result = await sequelize.transaction(async (t) => {
        const updateData = {};

        // 4.1. Comprador
        if (updates.receiverRnc !== undefined) updateData.receiverRnc = updates.receiverRnc || null;
        if (updates.receiverName !== undefined) updateData.receiverName = updates.receiverName || null;
        if (updates.issuedAt !== undefined) updateData.issuedAt = new Date(updates.issuedAt);

        // DT30 — IdDoc extendido
        if (updates.indicadorEnvioDiferido !== undefined) updateData.indicadorEnvioDiferido = updates.indicadorEnvioDiferido ?? null;
        if (updates.indicadorMontoGravado !== undefined) updateData.indicadorMontoGravado = updates.indicadorMontoGravado ?? null;
        if (updates.indicadorServicioTodoIncluido !== undefined) updateData.indicadorServicioTodoIncluido = updates.indicadorServicioTodoIncluido ?? null;
        if (updates.tipoIngresos !== undefined) updateData.tipoIngresos = updates.tipoIngresos || null;
        if (updates.tipoPago !== undefined) updateData.tipoPago = updates.tipoPago ?? null;
        if (updates.fechaLimitePago !== undefined) updateData.fechaLimitePago = updates.fechaLimitePago ? new Date(updates.fechaLimitePago) : null;
        if (updates.terminoPago !== undefined) updateData.terminoPago = updates.terminoPago || null;
        if (updates.formasPago !== undefined) updateData.formasPago = updates.formasPago || null;
        if (updates.tipoCuentaPago !== undefined) updateData.tipoCuentaPago = updates.tipoCuentaPago || null;
        if (updates.numeroCuentaPago !== undefined) updateData.numeroCuentaPago = updates.numeroCuentaPago || null;
        if (updates.bancoPago !== undefined) updateData.bancoPago = updates.bancoPago || null;
        if (updates.fechaDesde !== undefined) updateData.fechaDesde = updates.fechaDesde ? new Date(updates.fechaDesde) : null;
        if (updates.fechaHasta !== undefined) updateData.fechaHasta = updates.fechaHasta ? new Date(updates.fechaHasta) : null;
        if (updates.totalPaginas !== undefined) updateData.totalPaginas = updates.totalPaginas ?? null;

        // DT30 — Emisor extendido
        if (updates.codigoVendedor !== undefined) updateData.codigoVendedor = updates.codigoVendedor || null;
        if (updates.numeroFacturaInterna !== undefined) updateData.numeroFacturaInterna = updates.numeroFacturaInterna || null;
        if (updates.numeroPedidoInterno !== undefined) updateData.numeroPedidoInterno = updates.numeroPedidoInterno || null;
        if (updates.zonaVenta !== undefined) updateData.zonaVenta = updates.zonaVenta || null;
        if (updates.rutaVenta !== undefined) updateData.rutaVenta = updates.rutaVenta || null;
        if (updates.informacionAdicionalEmisor !== undefined) updateData.informacionAdicionalEmisor = updates.informacionAdicionalEmisor || null;

        // DT30 — Comprador extendido
        if (updates.contactoComprador !== undefined) updateData.contactoComprador = updates.contactoComprador || null;
        if (updates.correoComprador !== undefined) updateData.correoComprador = updates.correoComprador || null;
        if (updates.direccionComprador !== undefined) updateData.direccionComprador = updates.direccionComprador || null;
        if (updates.municipioComprador !== undefined) updateData.municipioComprador = updates.municipioComprador || null;
        if (updates.provinciaComprador !== undefined) updateData.provinciaComprador = updates.provinciaComprador || null;
        if (updates.fechaEntrega !== undefined) updateData.fechaEntrega = updates.fechaEntrega ? new Date(updates.fechaEntrega) : null;
        if (updates.contactoEntrega !== undefined) updateData.contactoEntrega = updates.contactoEntrega || null;
        if (updates.direccionEntrega !== undefined) updateData.direccionEntrega = updates.direccionEntrega || null;
        if (updates.telefonoAdicional !== undefined) updateData.telefonoAdicional = updates.telefonoAdicional || null;
        if (updates.fechaOrdenCompra !== undefined) updateData.fechaOrdenCompra = updates.fechaOrdenCompra ? new Date(updates.fechaOrdenCompra) : null;
        if (updates.numeroOrdenCompra !== undefined) updateData.numeroOrdenCompra = updates.numeroOrdenCompra || null;
        if (updates.codigoInternoComprador !== undefined) updateData.codigoInternoComprador = updates.codigoInternoComprador || null;
        if (updates.responsablePago !== undefined) updateData.responsablePago = updates.responsablePago || null;
        if (updates.informacionAdicionalComprador !== undefined) updateData.informacionAdicionalComprador = updates.informacionAdicionalComprador || null;

        // DT30 — Info adicional extendido
        if (updates.numeroReferencia !== undefined) updateData.infoNumeroReferencia = updates.numeroReferencia || null;
        if (updates.pesoBruto !== undefined) updateData.infoPesoBruto = updates.pesoBruto ?? null;
        if (updates.pesoNeto !== undefined) updateData.infoPesoNeto = updates.pesoNeto ?? null;
        if (updates.unidadPesoBruto !== undefined) updateData.infoUnidadPesoBruto = updates.unidadPesoBruto ?? null;
        if (updates.unidadPesoNeto !== undefined) updateData.infoUnidadPesoNeto = updates.unidadPesoNeto ?? null;
        if (updates.cantidadBulto !== undefined) updateData.infoCantidadBulto = updates.cantidadBulto ?? null;
        if (updates.unidadBulto !== undefined) updateData.infoUnidadBulto = updates.unidadBulto ?? null;
        if (updates.volumenBulto !== undefined) updateData.infoVolumenBulto = updates.volumenBulto ?? null;
        if (updates.unidadVolumen !== undefined) updateData.infoUnidadVolumen = updates.unidadVolumen ?? null;

        // DT30 — Totales extendido
        if (updates.montoImpuestoAdicional !== undefined) updateData.montoImpuestoAdicional = updates.montoImpuestoAdicional ?? null;
        if (updates.impuestosAdicionales !== undefined) updateData.impuestosAdicionales = updates.impuestosAdicionales || null;
        if (updates.montoNoFacturable !== undefined) updateData.montoNoFacturable = updates.montoNoFacturable ?? null;
        if (updates.montoPeriodo !== undefined) updateData.montoPeriodo = updates.montoPeriodo ?? null;
        if (updates.saldoAnterior !== undefined) updateData.saldoAnterior = updates.saldoAnterior ?? null;
        if (updates.montoAvancePago !== undefined) updateData.montoAvancePago = updates.montoAvancePago ?? null;
        if (updates.valorPagar !== undefined) updateData.valorPagar = updates.valorPagar ?? null;
        if (updates.totalItbisPercepcion !== undefined) updateData.totalItbisPercepcion = updates.totalItbisPercepcion ?? null;
        if (updates.totalIsrPercepcion !== undefined) updateData.totalIsrPercepcion = updates.totalIsrPercepcion ?? null;

        // DT30 — OtraMoneda (encabezado)
        if (updates.tipoMoneda !== undefined) updateData.tipoMoneda = updates.tipoMoneda || null;
        if (updates.tipoCambio !== undefined) updateData.tipoCambio = updates.tipoCambio ?? null;
        if (updates.montoGravadoTotalOtraMoneda !== undefined) updateData.montoGravadoTotalOtraMoneda = updates.montoGravadoTotalOtraMoneda ?? null;
        if (updates.montoGravado1OtraMoneda !== undefined) updateData.montoGravado1OtraMoneda = updates.montoGravado1OtraMoneda ?? null;
        if (updates.montoGravado2OtraMoneda !== undefined) updateData.montoGravado2OtraMoneda = updates.montoGravado2OtraMoneda ?? null;
        if (updates.montoGravado3OtraMoneda !== undefined) updateData.montoGravado3OtraMoneda = updates.montoGravado3OtraMoneda ?? null;
        if (updates.montoExentoOtraMoneda !== undefined) updateData.montoExentoOtraMoneda = updates.montoExentoOtraMoneda ?? null;
        if (updates.totalItbisOtraMoneda !== undefined) updateData.totalItbisOtraMoneda = updates.totalItbisOtraMoneda ?? null;
        if (updates.totalItbis1OtraMoneda !== undefined) updateData.totalItbis1OtraMoneda = updates.totalItbis1OtraMoneda ?? null;
        if (updates.totalItbis2OtraMoneda !== undefined) updateData.totalItbis2OtraMoneda = updates.totalItbis2OtraMoneda ?? null;
        if (updates.totalItbis3OtraMoneda !== undefined) updateData.totalItbis3OtraMoneda = updates.totalItbis3OtraMoneda ?? null;
        if (updates.montoImpuestoAdicionalOtraMoneda !== undefined) updateData.montoImpuestoAdicionalOtraMoneda = updates.montoImpuestoAdicionalOtraMoneda ?? null;
        if (updates.impuestosAdicionalesOtraMoneda !== undefined) updateData.impuestosAdicionalesOtraMoneda = updates.impuestosAdicionalesOtraMoneda || null;
        if (updates.montoTotalOtraMoneda !== undefined) updateData.montoTotalOtraMoneda = updates.montoTotalOtraMoneda ?? null;

        // DT32 — Subtotales (caso "solo subtotales sin items")
        if (updates.items === undefined && updates.subtotales !== undefined) {
            const currentLines = await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']],
                transaction: t
            });

            const calculatedLinesFromDb = currentLines.map((l) => {
                const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
                return {
                    lineNumber: Number(raw.lineNumber),
                    itemCode: raw.itemCode,
                    itemName: raw.itemName,
                    description: raw.description,
                    indicadorBienoServicio: raw.indicadorBienoServicio,
                    unidadMedida: raw.unidadMedida,
                    recargo: raw.recargo,
                    cantidadReferencia: raw.cantidadReferencia,
                    unidadReferencia: raw.unidadReferencia,
                    gradosAlcohol: raw.gradosAlcohol,
                    precioUnitarioReferencia: raw.precioUnitarioReferencia,
                    fechaElaboracion: raw.fechaElaboracion,
                    fechaVencimientoItem: raw.fechaVencimientoItem,
                    additionalCodes: raw.additionalCodes,
                    subcantidades: raw.subcantidades,
                    subDescuentos: raw.subDescuentos,
                    subRecargos: raw.subRecargos,
                    impuestosAdicionales: raw.impuestosAdicionales,
                    pesoNetoKilogramo: raw.pesoNetoKilogramo,
                    pesoNetoMineria: raw.pesoNetoMineria,
                    tipoAfiliacion: raw.tipoAfiliacion,
                    liquidacion: raw.liquidacion,
                    quantity: Number(raw.quantity),
                    unitPrice: Number(raw.unitPrice),
                    discount: Number(raw.discount || 0),
                    itbisRate: Number(raw.itbisRate),
                    itbisAmount: Number(raw.itbisAmount),
                    indicadorFacturacion: Number(raw.indicadorFacturacion),
                    lineBase: roundMoney(
                        Number(raw.quantity) * Number(raw.unitPrice)
                        - Number(raw.discount || 0)
                        + Number(raw.recargo || 0)
                    ),
                    total: Number(raw.total),
                    subtotalId: raw.subtotalId
                };
            });

            await InvoiceSubtotal.destroy({
                where: { invoiceId: invoice.id },
                transaction: t
            });

            if (Array.isArray(updates.subtotales) && updates.subtotales.length > 0) {
                const subtotalesCalculados = calculateSubtotalsFromLines(
                    updates.subtotales,
                    calculatedLinesFromDb
                );

                const invoiceTotalsPrelimFromDb = calculateInvoiceTotals(
                    calculatedLinesFromDb
                );
                assertSubtotalsMatchInvoiceTotal(
                    subtotalesCalculados,
                    invoiceTotalsPrelimFromDb.total
                );

                await InvoiceSubtotal.bulkCreate(
                    subtotalesCalculados.map((st) => ({
                        invoiceId: invoice.id,
                        numeroSubtotal: st.numeroSubtotal,
                        descripcion: st.descripcion,
                        orden: st.orden,
                        montoGravadoTotal: st.montoGravadoTotal,
                        montoGravadoI1: st.montoGravadoI1,
                        montoGravadoI2: st.montoGravadoI2,
                        montoGravadoI3: st.montoGravadoI3,
                        subTotalItbis: st.subTotalItbis,
                        subTotalItbis1: st.subTotalItbis1,
                        subTotalItbis2: st.subTotalItbis2,
                        subTotalItbis3: st.subTotalItbis3,
                        subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                        subTotalExento: st.subTotalExento,
                        montoSubTotal: st.montoSubTotal,
                        lineas: st.lineas
                    })),
                    { transaction: t }
                );
            }
        }

        // 4.2. Si vienen items, reemplazar TODAS las líneas
        if (updates.items !== undefined) {
            const calculatedLines = updates.items.map((item, index) => {
                const totals = calculateLineTotals(item);
                return {
                    lineNumber: index + 1,
                    itemCode: item.itemCode || null,
                    description: item.description,
                    ...totals,
                    retencion: item.retencion || null
                };
            });

            const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

            let descuentosResueltos = [];
            let reemplazarDescuentos = false;

            if (updates.descuentosORecargos !== undefined) {
                reemplazarDescuentos = true;
                descuentosResueltos = prepareDescuentos(
                    updates.descuentosORecargos,
                    invoiceTotalsPrelim
                );
            } else {
                const existentes = await InvoiceDiscountCharge.findAll({
                    where: { invoiceId: invoice.id },
                    order: [['numeroLinea', 'ASC']],
                    transaction: t
                });
                descuentosResueltos = existentes.map(d => {
                    const raw = typeof d.toJSON === 'function' ? d.toJSON() : d;
                    return resolveDescuentoMonto(
                        {
                            numeroLinea: raw.numeroLinea,
                            tipoAjuste: raw.tipoAjuste,
                            indicadorNorma1007: raw.indicadorNorma1007,
                            descripcion: raw.descripcion,
                            tipoValor: raw.tipoValor,
                            valor: raw.valor,
                            monto: raw.monto,
                            montoOtraMoneda: raw.montoOtraMoneda,
                            indicadorFacturacion: raw.indicadorFacturacion
                        },
                        invoiceTotalsPrelim
                    );
                });
            }

            const invoiceTotals = applyDescuentosToTotals(
                invoiceTotalsPrelim,
                descuentosResueltos
            );

            updateData.subtotal = invoiceTotals.subtotal;
            updateData.itbis = invoiceTotals.itbis;
            updateData.total = invoiceTotals.total;

            updateData.montoGravado = invoiceTotals.montoGravado;
            updateData.itbis1Base = invoiceTotals.itbis1Base;
            updateData.itbis1Amount = invoiceTotals.itbis1Amount;
            updateData.itbis2Base = invoiceTotals.itbis2Base;
            updateData.itbis2Amount = invoiceTotals.itbis2Amount;
            updateData.exemptAmount = invoiceTotals.exemptAmount || null;

            updateData.itbis3Base = invoice.type === '46'
                ? invoiceTotals.itbis3Base
                : (invoiceTotals.itbis3Base || null);
            updateData.itbis3Amount = invoice.type === '46'
                ? invoiceTotals.itbis3Amount
                : (invoiceTotals.itbis3Amount || null);

            const tipoCambioFinal = updates.tipoCambio !== undefined
                ? updates.tipoCambio
                : invoice.tipoCambio;

            const otraMonedaTotals = calculateOtraMonedaTotals(
                calculatedLines,
                tipoCambioFinal,
                invoiceTotals
            );

            Object.assign(updateData, otraMonedaTotals);

            if (['41', '47'].includes(invoice.type)) {
                updateData.totalItbisRetenido = roundMoney(
                    calculatedLines.reduce(
                        (s, l) => s + Number(l.retencion?.montoItbisRetenido || 0),
                        0
                    )
                );
                updateData.totalIsrRetencion = roundMoney(
                    calculatedLines.reduce(
                        (s, l) => s + Number(l.retencion?.montoIsrRetenido || 0),
                        0
                    )
                );
            }

            if (updates.valorPagar === undefined) {
                updateData.valorPagar = calculateValorPagarNorma1007(
                    invoiceTotals.total,
                    descuentosResueltos
                );
            }

            await InvoiceLine.destroy({
                where: { invoiceId: invoice.id },
                transaction: t
            });

            await InvoiceLine.bulkCreate(
                calculatedLines.map((line) => ({
                    invoiceId: invoice.id,
                    lineNumber: line.lineNumber,
                    itemCode: line.itemCode,

                    itemName: line.itemName,
                    description: line.description,
                    indicadorBienoServicio: line.indicadorBienoServicio,
                    unidadMedida: line.unidadMedida,
                    recargo: line.recargo,
                    cantidadReferencia: line.cantidadReferencia,
                    unidadReferencia: line.unidadReferencia,
                    gradosAlcohol: line.gradosAlcohol,
                    precioUnitarioReferencia: line.precioUnitarioReferencia,
                    fechaElaboracion: line.fechaElaboracion,
                    fechaVencimientoItem: line.fechaVencimientoItem,

                    precioOtraMoneda: line.precioOtraMoneda,
                    descuentoOtraMoneda: line.descuentoOtraMoneda,
                    recargoOtraMoneda: line.recargoOtraMoneda,
                    montoItemOtraMoneda: line.montoItemOtraMoneda,

                    additionalCodes: line.additionalCodes,
                    subcantidades: line.subcantidades,
                    subDescuentos: line.subDescuentos,
                    subRecargos: line.subRecargos,
                    impuestosAdicionales: line.impuestosAdicionales,
                    pesoNetoKilogramo: line.pesoNetoKilogramo,
                    pesoNetoMineria: line.pesoNetoMineria,
                    tipoAfiliacion: line.tipoAfiliacion,
                    liquidacion: line.liquidacion,

                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discount: line.discount,
                    itbisRate: line.itbisRate,
                    itbisAmount: line.itbisAmount,
                    indicadorFacturacion: line.indicadorFacturacion,
                    total: line.total,

                    subtotalId: line.subtotalId,

                    retencionIndicador: line.retencion?.indicador ?? null,
                    montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                    montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
                })),
                { transaction: t }
            );

            if (reemplazarDescuentos) {
                await InvoiceDiscountCharge.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });
            }

            if (descuentosResueltos.length > 0) {
                if (reemplazarDescuentos) {
                    await InvoiceDiscountCharge.bulkCreate(
                        descuentosResueltos.map(d => ({
                            invoiceId: invoice.id,
                            numeroLinea: d.numeroLinea,
                            tipoAjuste: d.tipoAjuste,
                            indicadorNorma1007: d.indicadorNorma1007 ?? null,
                            descripcion: d.descripcion || null,
                            tipoValor: d.tipoValor,
                            valor: d.tipoValor === '%' ? d.valor : null,
                            monto: d.monto,
                            montoOtraMoneda: d.montoOtraMoneda ?? null,
                            indicadorFacturacion: d.indicadorFacturacion
                        })),
                        { transaction: t }
                    );
                } else {
                    for (const d of descuentosResueltos) {
                        await InvoiceDiscountCharge.update(
                            { monto: d.monto },
                            {
                                where: {
                                    invoiceId: invoice.id,
                                    numeroLinea: d.numeroLinea
                                },
                                transaction: t
                            }
                        );
                    }
                }
            }

            // DT32 — Subtotales cuando vienen items
            if (updates.subtotales !== undefined) {
                await InvoiceSubtotal.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });

                if (Array.isArray(updates.subtotales) && updates.subtotales.length > 0) {
                    const subtotalesCalculados = calculateSubtotalsFromLines(
                        updates.subtotales,
                        calculatedLines
                    );

                    assertSubtotalsMatchInvoiceTotal(
                        subtotalesCalculados,
                        invoiceTotalsPrelim.total
                    );

                    await InvoiceSubtotal.bulkCreate(
                        subtotalesCalculados.map((st) => ({
                            invoiceId: invoice.id,
                            numeroSubtotal: st.numeroSubtotal,
                            descripcion: st.descripcion,
                            orden: st.orden,
                            montoGravadoTotal: st.montoGravadoTotal,
                            montoGravadoI1: st.montoGravadoI1,
                            montoGravadoI2: st.montoGravadoI2,
                            montoGravadoI3: st.montoGravadoI3,
                            subTotalItbis: st.subTotalItbis,
                            subTotalItbis1: st.subTotalItbis1,
                            subTotalItbis2: st.subTotalItbis2,
                            subTotalItbis3: st.subTotalItbis3,
                            subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                            subTotalExento: st.subTotalExento,
                            montoSubTotal: st.montoSubTotal,
                            lineas: st.lineas
                        })),
                        { transaction: t }
                    );
                }
            } else {
                const existentes = await InvoiceSubtotal.findAll({
                    where: { invoiceId: invoice.id },
                    order: [['numeroSubtotal', 'ASC']],
                    transaction: t
                });

                if (existentes.length > 0) {
                    const inputExistentes = existentes.map((s) => {
                        const raw = typeof s.toJSON === 'function' ? s.toJSON() : s;
                        return {
                            numeroSubtotal: Number(raw.numeroSubtotal),
                            descripcion: raw.descripcion,
                            orden: raw.orden
                        };
                    });

                    const subtotalesCalculados = calculateSubtotalsFromLines(
                        inputExistentes,
                        calculatedLines
                    );

                    assertSubtotalsMatchInvoiceTotal(
                        subtotalesCalculados,
                        invoiceTotalsPrelim.total
                    );

                    for (const st of subtotalesCalculados) {
                        await InvoiceSubtotal.update(
                            {
                                montoGravadoTotal: st.montoGravadoTotal,
                                montoGravadoI1: st.montoGravadoI1,
                                montoGravadoI2: st.montoGravadoI2,
                                montoGravadoI3: st.montoGravadoI3,
                                subTotalItbis: st.subTotalItbis,
                                subTotalItbis1: st.subTotalItbis1,
                                subTotalItbis2: st.subTotalItbis2,
                                subTotalItbis3: st.subTotalItbis3,
                                subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                                subTotalExento: st.subTotalExento,
                                montoSubTotal: st.montoSubTotal,
                                lineas: st.lineas
                            },
                            {
                                where: {
                                    invoiceId: invoice.id,
                                    numeroSubtotal: st.numeroSubtotal
                                },
                                transaction: t
                            }
                        );
                    }
                }
            }
        }

        // DT-EXPORT — Recalcular OtraMoneda si cambia tipoCambio sin items
        if (updates.items === undefined && updates.tipoCambio !== undefined) {
            const currentLines = await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']],
                transaction: t
            });

            if (currentLines.length > 0) {
                const calculatedLines = currentLines.map(l => {
                    const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
                    return {
                        quantity: Number(raw.quantity),
                        unitPrice: Number(raw.unitPrice),
                        discount: Number(raw.discount || 0),
                        recargo: Number(raw.recargo || 0),
                        itbisRate: Number(raw.itbisRate),
                        itbisAmount: Number(raw.itbisAmount),
                        indicadorFacturacion: Number(raw.indicadorFacturacion),
                        lineBase: roundMoney(
                            Number(raw.quantity) * Number(raw.unitPrice)
                            - Number(raw.discount || 0)
                            + Number(raw.recargo || 0)
                        ),
                        total: Number(raw.total),
                        retencion: raw.retencionIndicador
                            ? { indicador: Number(raw.retencionIndicador), montoItbisRetenido: Number(raw.montoItbisRetenido || 0), montoIsrRetenido: Number(raw.montoIsrRetenido || 0) }
                            : null
                    };
                });

                const invoiceTotals = calculateInvoiceTotals(calculatedLines);

                const otraMonedaTotals = calculateOtraMonedaTotals(
                    calculatedLines,
                    updates.tipoCambio,
                    invoiceTotals
                );
                Object.assign(updateData, otraMonedaTotals);

                for (const line of calculatedLines) {
                    await InvoiceLine.update(
                        {
                            precioOtraMoneda: line.precioOtraMoneda,
                            montoItemOtraMoneda: line.montoItemOtraMoneda
                        },
                        {
                            where: {
                                invoiceId: invoice.id,
                                lineNumber: calculatedLines.indexOf(line) + 1
                            },
                            transaction: t
                        }
                    );
                }
            }
        }

        // Caso B: NO items, SÍ descuentos
        if (updates.items === undefined && updates.descuentosORecargos !== undefined) {
            const currentLines = await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']],
                transaction: t
            });

            if (currentLines.length > 0) {
                const calculatedLines = currentLines.map(l => {
                    const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
                    return {
                        quantity: Number(raw.quantity),
                        unitPrice: Number(raw.unitPrice),
                        discount: Number(raw.discount || 0),
                        recargo: Number(raw.recargo || 0),
                        itbisRate: Number(raw.itbisRate),
                        itbisAmount: Number(raw.itbisAmount),
                        indicadorFacturacion: Number(raw.indicadorFacturacion),
                        lineBase: roundMoney(
                            Number(raw.quantity) * Number(raw.unitPrice)
                            - Number(raw.discount || 0)
                            + Number(raw.recargo || 0)
                        ),
                        total: Number(raw.total),
                        montoItbisRetenido: Number(raw.montoItbisRetenido || 0),
                        montoIsrRetenido: Number(raw.montoIsrRetenido || 0)
                    };
                });

                const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

                const descuentosResueltos = prepareDescuentos(
                    updates.descuentosORecargos,
                    invoiceTotalsPrelim
                );

                const invoiceTotals = applyDescuentosToTotals(
                    invoiceTotalsPrelim,
                    descuentosResueltos
                );

                updateData.subtotal = invoiceTotals.subtotal;
                updateData.itbis = invoiceTotals.itbis;
                updateData.total = invoiceTotals.total;
                updateData.montoGravado = invoiceTotals.montoGravado;
                updateData.itbis1Base = invoiceTotals.itbis1Base;
                updateData.itbis1Amount = invoiceTotals.itbis1Amount;
                updateData.itbis2Base = invoiceTotals.itbis2Base;
                updateData.itbis2Amount = invoiceTotals.itbis2Amount;
                updateData.exemptAmount = invoiceTotals.exemptAmount || null;

                updateData.itbis3Base = invoice.type === '46'
                    ? invoiceTotals.itbis3Base
                    : (invoiceTotals.itbis3Base || null);
                updateData.itbis3Amount = invoice.type === '46'
                    ? invoiceTotals.itbis3Amount
                    : (invoiceTotals.itbis3Amount || null);

                if (['41', '47'].includes(invoice.type)) {
                    updateData.totalItbisRetenido = roundMoney(
                        calculatedLines.reduce(
                            (s, l) => s + Number(l.montoItbisRetenido || 0),
                            0
                        )
                    );
                    updateData.totalIsrRetencion = roundMoney(
                        calculatedLines.reduce(
                            (s, l) => s + Number(l.montoIsrRetenido || 0),
                            0
                        )
                    );
                }

                if (updates.valorPagar === undefined) {
                    updateData.valorPagar = calculateValorPagarNorma1007(
                        invoiceTotals.total,
                        descuentosResueltos
                    );
                }

                await InvoiceDiscountCharge.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });

                if (descuentosResueltos.length > 0) {
                    await InvoiceDiscountCharge.bulkCreate(
                        descuentosResueltos.map(d => ({
                            invoiceId: invoice.id,
                            numeroLinea: d.numeroLinea,
                            tipoAjuste: d.tipoAjuste,
                            indicadorNorma1007: d.indicadorNorma1007 ?? null,
                            descripcion: d.descripcion || null,
                            tipoValor: d.tipoValor,
                            valor: d.tipoValor === '%' ? d.valor : null,
                            monto: d.monto,
                            montoOtraMoneda: d.montoOtraMoneda ?? null,
                            indicadorFacturacion: d.indicadorFacturacion
                        })),
                        { transaction: t }
                    );
                }
            }
        }

        // DT35 — modificationCode / modificationReason
        if (updates.modificationCode !== undefined) {
            const CODIGOS_PERMITIDOS_POR_TIPO = {
                '31': [4, 5],
                '32': [4],
                '33': [1, 2, 3, 4],
                '34': [1, 2, 3, 4],
                '41': [4],
                '43': [4],
                '44': [4],
                '45': [4],
                '46': [4],
                '47': [4]
            };

            const code = Number(updates.modificationCode);
            const permitidos = CODIGOS_PERMITIDOS_POR_TIPO[String(invoice.type)] || [];

            if (permitidos.length === 0) {
                throw new AppError(
                    `Tipo ${invoice.type}: CodigoModificacion no aplica a este tipo de e-CF`,
                    409,
                    'MODIFICATION_CODE_NOT_ALLOWED'
                );
            }

            if (!permitidos.includes(code)) {
                throw new AppError(
                    `Tipo ${invoice.type}: CodigoModificacion=${code} no permitido. ` +
                    `Valores permitidos: [${permitidos.join(', ')}]. ` +
                    `Recuerda: 1, 2, 3 solo aplican a Notas (33/34); 5 solo aplica a FC Fiscal (31).`,
                    409,
                    'MODIFICATION_CODE_NOT_ALLOWED_FOR_TYPE'
                );
            }

            const requiresOriginalExists =
                invoice.type === '33' ||
                invoice.type === '34' ||
                (invoice.type === '31' && code === 5);

            if (requiresOriginalExists && !invoice.modifiedNcf) {
                throw new AppError(
                    `Tipo ${invoice.type}: no puedes cambiar CodigoModificacion sin NCFModificado previo`,
                    409,
                    'MODIFICATION_CODE_WITHOUT_NCF'
                );
            }

            updateData.modificationCode = code;
        }

        if (updates.modificationReason !== undefined) {
            if (invoice.type !== '33' && invoice.type !== '34') {
                throw new AppError(
                    `Tipo ${invoice.type}: RazonModificacion solo aplica a Notas (33/34)`,
                    409,
                    'RAZON_MODIFICACION_NOT_ALLOWED'
                );
            }
            updateData.modificationReason = updates.modificationReason || null;
        }

        // Si es 34 y cambia issuedAt, recalcular indicadorNotaCredito
        if (invoice.type === '34' && updates.issuedAt !== undefined) {
            const modDate = new Date(invoice.modifiedNcfDate);
            const newIssuedDate = new Date(updates.issuedAt);
            const diffDays = (newIssuedDate - modDate) / (1000 * 60 * 60 * 24);
            updateData.indicadorNotaCredito = diffDays > 30 ? 1 : 0;
        }

        // DT-EXPORT — FIX: finalFormasPago y finalTotal
        const finalFormasPago = updates.formasPago !== undefined
            ? updates.formasPago
            : (invoice.formasPago || []);
        const finalTotal = updateData.total ?? invoice.total;

        // DT40-FIX (update) — Validar formasPago vs monto esperado
        if (Array.isArray(finalFormasPago) && finalFormasPago.length > 0) {
            const sumaFormasPago = finalFormasPago.reduce(
                (sum, fp) => sum + Number(fp.montoPago || 0),
                0
            );

            let montoEsperado = Number(finalTotal);

            if (invoice.type === '41') {
                const totalRetenciones =
                    Number(updateData.totalItbisRetenido ?? invoice.totalItbisRetenido ?? 0) +
                    Number(updateData.totalIsrRetencion ?? invoice.totalIsrRetencion ?? 0);
                montoEsperado = roundMoney(montoEsperado - totalRetenciones);
            } else if (invoice.type === '47') {
                const totalRetenciones =
                    Number(updateData.totalIsrRetencion ?? invoice.totalIsrRetencion ?? 0);
                montoEsperado = roundMoney(montoEsperado - totalRetenciones);
            }

            const diff = Math.abs(sumaFormasPago - montoEsperado);
            if (diff > 0.01) {
                const tipoMsg = invoice.type === '41'
                    ? `(pago neto esperado en 41 = total ${Number(finalTotal).toFixed(2)} − retenciones ITBIS+ISR ${(Number(updateData.totalItbisRetenido ?? invoice.totalItbisRetenido ?? 0) + Number(updateData.totalIsrRetencion ?? invoice.totalIsrRetencion ?? 0)).toFixed(2)} = ${montoEsperado.toFixed(2)})`
                    : invoice.type === '47'
                        ? `(pago neto esperado en 47 = total ${Number(finalTotal).toFixed(2)} − retención ISR ${Number(updateData.totalIsrRetencion ?? invoice.totalIsrRetencion ?? 0).toFixed(2)} = ${montoEsperado.toFixed(2)})`
                        : '';
                throw new AppError(
                    `Suma de formas de pago (${sumaFormasPago.toFixed(2)}) no coincide con el monto esperado (${montoEsperado.toFixed(2)}) ${tipoMsg}. ` +
                    `Diferencia: ${diff.toFixed(2)}.`,
                    409,
                    'FORMAS_PAGO_MISMATCH'
                );
            }
        }

        // 4.3. Actualizar la factura
        await invoice.update(updateData, { transaction: t });

        // 4.3.5. Regenerar XML si sigue draft
        if (invoice.status === 'draft') {
            try {
                const { generateAndSaveInvoiceXML } = require('../../documents/xml/xml-integrator');
                await generateAndSaveInvoiceXML(invoice.id, t);
            } catch (xmlErr) {
                console.error('[updateMyInvoice] XML regen failed:', xmlErr.message);
            }
        }

        // 4.3.6. DT39 — RFCE según si sigue aplicando
        if (invoice.status === 'draft' && invoice.type === '32') {
            const currentTotal = Number(invoice.total);
            if (currentTotal < 250000) {
                try {
                    const { generateAndSaveRFCE } = require('../../documents/xml/xml-integrator');
                    await generateAndSaveRFCE(invoice.id, '000000', t);
                } catch (rfceErr) {
                    console.error('[updateMyInvoice] RFCE regen failed:', rfceErr.message);
                }
            } else {
                try {
                    await RfceDocument.destroy({
                        where: { invoiceId: invoice.id },
                        transaction: t
                    });
                } catch (err) {
                    console.error('[updateMyInvoice] RFCE cleanup failed:', err.message);
                }
            }
        }

        // 4.4. Audit log (con snapshot de descuentos post-update)
        try {
            const descuentosAfter = await InvoiceDiscountCharge.findAll({
                where: { invoiceId: invoice.id },
                transaction: t
            });
            const descuentosAfterCount = descuentosAfter.length;
            const descuentosAfterTotal = roundMoney(
                descuentosAfter.reduce((sum, d) => sum + Number(d.monto || 0), 0)
            );

            const after = {
                ...updateData,
                descuentosCount: descuentosAfterCount,
                descuentosTotal: descuentosAfterTotal
            };

            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.updated',
                entity: 'invoice',
                entityId: invoice.id,
                before,
                after,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return invoice;
    });

    // 5. Recargar con relaciones
    const fullInvoice = await Invoice.findByPk(result.id, {
        include: [
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

    // 6. Regenerar XML en disco si draft (fire-and-forget)
    if (fullInvoice.status === 'draft' && fullInvoice.xmlContent) {
        const { saveXMLToDisk } = require('../../documents/storage/xml-storage');
        saveXMLToDisk(fullInvoice, fullInvoice.xmlContent).catch(err => {
            console.error('[updateMyInvoice] saveXMLToDisk failed:', err.message);
        });
    }

    return buildInvoiceResponse(fullInvoice, {
        lineCount: fullInvoice.lines.length,
        hideXml: false
    });
}

module.exports = { updateMyInvoice };