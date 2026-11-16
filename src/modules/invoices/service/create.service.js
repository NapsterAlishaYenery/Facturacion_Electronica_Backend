// ============================================================
// create.service.js
// Crear factura (company_admin).
// Maneja los 10 tipos de e-CF. Qué campos extras se guardan
// depende de lo que el Joi haya dejado pasar según el tipo.
//
// Este archivo solo ORQUESTA:
//   - valida empresa + suscripción (assertSubscriptionCanUse)
//   - resuelve original (resolveModifiedInvoice)
//   - asigna NCF (assignNextNCF)
//   - calcula líneas (calculateLineTotals)
//   - calcula totales (calculateInvoiceTotals → applyDescuentos → calculateOtraMoneda)
//   - persiste Invoice + InvoiceLine + InvoiceSubtotal + InvoiceDiscountCharge
//   - genera XML + RFCE
//   - audit log
// La aritmética pesada vive en service/totals/*.
// ============================================================

const sequelize = require('../../../config/database');
const { assertSubscriptionCanUse } = require('../../../shared/utils/subscription.helpers');
const {
    Company,
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
const { mapTransporteFields } = require('./helpers/mappers/transporte.mapper');
const { mapInfoAdicionalFields } = require('./helpers/mappers/info-adicional.mapper');
const { buildInvoiceResponse } = require('./build/invoice-response.builder');
const { calculateLineTotals } = require('./build/invoice-lines.builder');
const { calculateInvoiceTotals } = require('./totals/invoice-totals');
const { calculateSubtotalsFromLines, assertSubtotalsMatchInvoiceTotal } = require('./totals/subtotals');
const { calculateOtraMonedaTotals } = require('./totals/otra-moneda');
const { prepareDescuentos, applyDescuentosToTotals, calculateValorPagarNorma1007 } = require('./totals/descuentos');
const { assignNextNCF } = require('./ncf/assign-next-ncf');
const { resolveModifiedInvoice } = require('./ncf/build-reference');

// ------------------------------------------------------------
// Crear factura (company_admin)
// ------------------------------------------------------------
async function createMyInvoice(companyId, data, reqUser, reqInfo = {}) {
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
        // Comprador extranjero (46, 47)
        receiverIdentificadorExtranjero,
        receiverPais,
        // Exento (43, 44, 47)
        exemptAmount,
        transporte,
        // Info adicional (46)
        informacionesAdicionales,
        // Notas (33, 34)
        modifiedNcf,
        modifiedNcfIssuerRnc,
        modifiedNcfDate,
        modificationCode,
        modificationReason,
        indicadorNotaCredito,

        // DT30 — IdDoc extendido
        indicadorEnvioDiferido,
        indicadorMontoGravado,
        indicadorServicioTodoIncluido,
        tipoIngresos,
        tipoPago,
        fechaLimitePago,
        terminoPago,
        formasPago,
        tipoCuentaPago,
        numeroCuentaPago,
        bancoPago,
        fechaDesde,
        fechaHasta,
        totalPaginas,

        // DT30 — Emisor extendido
        codigoVendedor,
        numeroFacturaInterna,
        numeroPedidoInterno,
        zonaVenta,
        rutaVenta,
        informacionAdicionalEmisor,

        // DT30 — Comprador extendido
        contactoComprador,
        correoComprador,
        direccionComprador,
        municipioComprador,
        provinciaComprador,
        fechaEntrega,
        contactoEntrega,
        direccionEntrega,
        telefonoAdicional,
        fechaOrdenCompra,
        numeroOrdenCompra,
        codigoInternoComprador,
        responsablePago,
        informacionAdicionalComprador,

        // DT30 — Totales extendido
        montoImpuestoAdicional,
        impuestosAdicionales,
        montoNoFacturable,
        montoPeriodo,
        saldoAnterior,
        montoAvancePago,
        valorPagar,
        totalItbisPercepcion,
        totalIsrPercepcion,

        // DT30 — OtraMoneda
        tipoMoneda,
        tipoCambio,
        // DT32 — Subtotales
        subtotales,
        // DT33 — Descuentos o Recargos globales
        descuentosORecargos,
    } = data;

    const isNota = type === '33' || type === '34';

    // 1. Empresa existe y está activa
    const company = await Company.findByPk(companyId);
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
    if (!company.isActive) {
        throw new AppError(
            'Company is inactive. Cannot issue invoices.',
            403,
            'COMPANY_INACTIVE'
        );
    }

    // Transacción
    const result = await sequelize.transaction(async (t) => {

        // 2. Suscripción + límite
        let subscription = null;
        if (!company.isSystemOwner) {
            subscription = await assertSubscriptionCanUse(
                companyId,
                'invoices',
                { transaction: t, lock: true }
            );
        }
        const skipLimitCheck = !subscription;

        // 4.1. DT35 — Resolver factura original
        let originalInvoice = null;
        const needsOriginalLookup =
            isNota ||
            (type === '31' && Number(modificationCode) === 5) ||
            (Number(modificationCode) === 4);

        if (needsOriginalLookup) {
            originalInvoice = await resolveModifiedInvoice(
                companyId,
                type,
                modifiedNcf,
                modificationCode,
                t
            );
        }

        // 4.2. Asignar NCF
        const { sequence, ncf } = await assignNextNCF(companyId, type, t, reqUser);

        // 4.3. Calcular líneas
        const calculatedLines = items.map((item, index) => {
            const totals = calculateLineTotals(item);
            return {
                lineNumber: index + 1,
                itemCode: item.itemCode || null,
                description: item.description,
                ...totals,
                retencion: item.retencion || null
            };
        });

        // 4.4. Totales PRELIMINARES
        const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

        // DT31 — Retenciones (41, 47)
        let finalTotalItbisRetenido = null;
        let finalTotalIsrRetencion = null;

        if (['41', '47'].includes(type)) {
            const sumItbisRet = calculatedLines.reduce(
                (sum, l) => sum + Number(l.retencion?.montoItbisRetenido || 0),
                0
            );
            const sumIsrRet = calculatedLines.reduce(
                (sum, l) => sum + Number(l.retencion?.montoIsrRetenido || 0),
                0
            );
            finalTotalItbisRetenido = roundMoney(sumItbisRet);
            finalTotalIsrRetencion = roundMoney(sumIsrRet);
        }

        // DT33 — Descuentos y recargos GLOBALES
        const descuentosResueltos = prepareDescuentos(
            descuentosORecargos,
            invoiceTotalsPrelim
        );

        const invoiceTotals = applyDescuentosToTotals(
            invoiceTotalsPrelim,
            descuentosResueltos
        );

        // DT-EXPORT — OtraMoneda
        const otraMonedaTotals = calculateOtraMonedaTotals(
            calculatedLines,
            tipoCambio,
            invoiceTotals
        );

        // Defensa 250K
        if (type === '32' && invoiceTotals.total >= 250000 && !receiverRnc) {
            throw new AppError(
                'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)',
                409,
                'DGII_250K_RULE'
            );
        }

        // DT40-FIX — Validar formasPago vs monto esperado
        if (Array.isArray(formasPago) && formasPago.length > 0) {
            const sumaFormasPago = formasPago.reduce(
                (sum, fp) => sum + Number(fp.montoPago || 0),
                0
            );

            let montoEsperado = Number(invoiceTotals.total);

            if (type === '41') {
                const totalRetenciones =
                    Number(finalTotalItbisRetenido || 0) +
                    Number(finalTotalIsrRetencion || 0);
                montoEsperado = roundMoney(montoEsperado - totalRetenciones);
            } else if (type === '47') {
                const totalRetenciones = Number(finalTotalIsrRetencion || 0);
                montoEsperado = roundMoney(montoEsperado - totalRetenciones);
            }

            const diff = Math.abs(sumaFormasPago - montoEsperado);
            if (diff > 0.01) {
                const tipoMsg = type === '41'
                    ? `(MontoTotal ${invoiceTotals.total.toFixed(2)} − retenciones ITBIS+ISR ${(Number(finalTotalItbisRetenido || 0) + Number(finalTotalIsrRetencion || 0)).toFixed(2)} = pago neto ${montoEsperado.toFixed(2)})`
                    : type === '47'
                        ? `(MontoTotal ${invoiceTotals.total.toFixed(2)} − retención ISR ${Number(finalTotalIsrRetencion || 0).toFixed(2)} = pago neto ${montoEsperado.toFixed(2)})`
                        : '';
                throw new AppError(
                    `Suma de formas de pago (${sumaFormasPago.toFixed(2)}) no coincide con el monto esperado (${montoEsperado.toFixed(2)}) ${tipoMsg}. ` +
                    `Diferencia: ${diff.toFixed(2)}. Ajusta los montos de cada forma de pago.`,
                    409,
                    'FORMAS_PAGO_MISMATCH'
                );
            }
        }

        // 4.5. issuedAt
        const finalIssuedAt = issuedAt ? new Date(issuedAt) : new Date();

        // 4.6. DT35 — <InformacionReferencia>
        const hasReferencia =
            isNota ||
            (type === '31' && Number(modificationCode) === 5) ||
            (Number(modificationCode) === 4 && modifiedNcf);

        let referenciFields = {};

        if (hasReferencia) {
            const originalIssuerRnc = originalInvoice
                ? originalInvoice.issuerRnc
                : null;

            let fechaModificada = null;
            if (modifiedNcfDate) {
                fechaModificada = new Date(modifiedNcfDate);
            } else if (originalInvoice && originalInvoice.issuedAt) {
                fechaModificada = new Date(originalInvoice.issuedAt);
            }

            referenciFields = {
                modifiedNcf: modifiedNcf || (originalInvoice ? originalInvoice.ncf : null),
                modifiedNcfIssuerRnc: modifiedNcfIssuerRnc || originalIssuerRnc || null,
                modifiedNcfDate: fechaModificada,
                modificationCode: modificationCode ?? null,
                modificationReason: isNota ? (modificationReason || null) : null,
                indicadorNotaCredito: type === '34' ? indicadorNotaCredito : null
            };
        }

        // 4.6.1 — Exento final por tipo
        let finalExemptAmount;
        if (['43', '44', '47'].includes(type)) {
            finalExemptAmount = exemptAmount ?? invoiceTotals.exemptAmount;
        } else {
            finalExemptAmount = invoiceTotals.exemptAmount;
        }

        // 4.7. Crear factura
        const invoice = await Invoice.create({
            companyId,
            sequenceId: sequence.id,
            type,
            ncf,
            status: 'draft',
            issuerRnc: company.rnc,
            issuerName: company.name,
            receiverRnc: receiverRnc || null,
            receiverName: receiverName || null,

            receiverIdentificadorExtranjero: receiverIdentificadorExtranjero || null,
            receiverPais: receiverPais || null,

            subtotal: invoiceTotals.subtotal,
            itbis: invoiceTotals.itbis,
            total: invoiceTotals.total,

            montoGravado: invoiceTotals.montoGravado,
            itbis1Base: invoiceTotals.itbis1Base,
            itbis1Amount: invoiceTotals.itbis1Amount,
            itbis2Base: invoiceTotals.itbis2Base,
            itbis2Amount: invoiceTotals.itbis2Amount,

            exemptAmount: finalExemptAmount || null,

            // CHECK constraint chk_invoices_46_itbis3: tipo 46 requiere NOT NULL.
            itbis3Base: type === '46'
                ? invoiceTotals.itbis3Base
                : (invoiceTotals.itbis3Base || null),
            itbis3Amount: type === '46'
                ? invoiceTotals.itbis3Amount
                : (invoiceTotals.itbis3Amount || null),

            totalItbisRetenido: finalTotalItbisRetenido,
            totalIsrRetencion: finalTotalIsrRetencion,

            issuedAt: finalIssuedAt,

            // DT30 — IdDoc extendido
            indicadorEnvioDiferido: indicadorEnvioDiferido ?? null,
            indicadorMontoGravado: indicadorMontoGravado ?? null,
            indicadorServicioTodoIncluido: indicadorServicioTodoIncluido ?? null,
            tipoIngresos: tipoIngresos || null,
            tipoPago: tipoPago ?? null,
            fechaLimitePago: fechaLimitePago ? new Date(fechaLimitePago) : null,
            terminoPago: terminoPago || null,
            formasPago: formasPago || null,
            tipoCuentaPago: tipoCuentaPago || null,
            numeroCuentaPago: numeroCuentaPago || null,
            bancoPago: bancoPago || null,
            fechaDesde: fechaDesde ? new Date(fechaDesde) : null,
            fechaHasta: fechaHasta ? new Date(fechaHasta) : null,
            totalPaginas: totalPaginas ?? null,

            // DT30 — Emisor extendido
            codigoVendedor: codigoVendedor || reqUser?.codigoVendedor || null,
            numeroFacturaInterna: numeroFacturaInterna || null,
            numeroPedidoInterno: numeroPedidoInterno || null,
            zonaVenta: zonaVenta || null,
            rutaVenta: rutaVenta || null,
            informacionAdicionalEmisor: informacionAdicionalEmisor || null,

            // DT30 — Comprador extendido
            contactoComprador: contactoComprador || null,
            correoComprador: correoComprador || null,
            direccionComprador: direccionComprador || null,
            municipioComprador: municipioComprador || null,
            provinciaComprador: provinciaComprador || null,
            fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
            contactoEntrega: contactoEntrega || null,
            direccionEntrega: direccionEntrega || null,
            telefonoAdicional: telefonoAdicional || null,
            fechaOrdenCompra: fechaOrdenCompra ? new Date(fechaOrdenCompra) : null,
            numeroOrdenCompra: numeroOrdenCompra || null,
            codigoInternoComprador: codigoInternoComprador || null,
            responsablePago: responsablePago || null,
            informacionAdicionalComprador: informacionAdicionalComprador || null,

            // DT30 — Totales extendido
            montoImpuestoAdicional: montoImpuestoAdicional ?? null,
            impuestosAdicionales: impuestosAdicionales || null,
            montoNoFacturable: montoNoFacturable ?? null,
            montoPeriodo: montoPeriodo ?? null,
            saldoAnterior: saldoAnterior ?? null,
            montoAvancePago: montoAvancePago ?? null,
            valorPagar: valorPagar ?? calculateValorPagarNorma1007(
                invoiceTotals.total,
                descuentosResueltos
            ) ?? null,

            totalItbisPercepcion: totalItbisPercepcion ?? null,
            totalIsrPercepcion: totalIsrPercepcion ?? null,

            // DT30 — OtraMoneda
            tipoMoneda: tipoMoneda || null,
            tipoCambio: tipoCambio ?? null,
            ...otraMonedaTotals,

            // Transporte + Info adicional
            ...mapTransporteFields(transporte),
            ...mapInfoAdicionalFields(informacionesAdicionales),

            // DT35 — <InformacionReferencia>
            ...referenciFields
        }, { transaction: t });

        // 4.8. Crear líneas
        const lines = await InvoiceLine.bulkCreate(
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
            { transaction: t, returning: true }
        );

        // 4.8.1. DT32 — Subtotales
        let subtotalesCreados = [];
        if (Array.isArray(subtotales) && subtotales.length > 0) {
            const subtotalesCalculados = calculateSubtotalsFromLines(
                subtotales,
                calculatedLines
            );

            assertSubtotalsMatchInvoiceTotal(subtotalesCalculados, invoiceTotalsPrelim.total);

            subtotalesCreados = await InvoiceSubtotal.bulkCreate(
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
                { transaction: t, returning: true }
            );
        }

        // 4.8.2. DT33 — Crear descuentos/recargos globales
        let descuentosCreados = [];
        if (descuentosResueltos.length > 0) {
            descuentosCreados = await InvoiceDiscountCharge.bulkCreate(
                descuentosResueltos.map((d) => ({
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
                { transaction: t, returning: true }
            );
        }

        // 4.8.5. Generar y persistir XML
        try {
            const { generateAndSaveInvoiceXML } = require('../../documents/xml/xml-integrator');
            await generateAndSaveInvoiceXML(invoice.id, t);
        } catch (xmlErr) {
            console.error('[createMyInvoice] XML generation failed:', xmlErr.message);
        }

        // 4.8.6. DT39 — Generar RFCE si aplica
        try {
            const { generateAndSaveRFCE } = require('../../documents/xml/xml-integrator');
            await generateAndSaveRFCE(invoice.id, '000000', t);
        } catch (rfceErr) {
            console.error('[createMyInvoice] RFCE generation failed:', rfceErr.message);
        }

        // 4.9. Incrementar contador (excepto system owner)
        if (!skipLimitCheck && subscription) {
            await subscription.increment('invoicesUsedThisMonth', {
                by: 1,
                transaction: t
            });
        }

        // 4.10. Audit log
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.created',
                entity: 'invoice',
                entityId: invoice.id,
                after: {
                    ncf: invoice.ncf,
                    type: invoice.type,
                    total: invoice.total,
                    lineCount: lines.length,
                    receiverRnc: invoice.receiverRnc || null,
                    receiverIdentificadorExtranjero: invoice.receiverIdentificadorExtranjero || null,
                    modifiedNcf: invoice.modifiedNcf || null,
                    exemptAmount: invoice.exemptAmount || null,
                    itbis3Base: invoice.itbis3Base || null,
                    totalItbisRetenido: invoice.totalItbisRetenido || null,
                    totalIsrRetencion: invoice.totalIsrRetencion || null,
                    transporteVia: invoice.transporteVia || null,
                    transportePaisDestino: invoice.transportePaisDestino || null,
                    tipoPago: invoice.tipoPago ?? null,
                    tipoIngresos: invoice.tipoIngresos || null,
                    codigoVendedor: invoice.codigoVendedor || null,
                    tipoMoneda: invoice.tipoMoneda || null,
                    montoImpuestoAdicional: invoice.montoImpuestoAdicional ?? null,
                    descuentosCount: descuentosCreados.length,
                    descuentosTotal: descuentosCreados.reduce(
                        (sum, d) => sum + Number(d.monto || 0), 0
                    )
                },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return { invoice, lines, sequence };
    });

    // 5. Recargar con relaciones
    const fullInvoice = await Invoice.findByPk(result.invoice.id, {
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

    // 6. Guardar XML en disco (fire-and-forget)
    if (fullInvoice.xmlContent) {
        const { saveXMLToDisk } = require('../../documents/storage/xml-storage');
        saveXMLToDisk(fullInvoice, fullInvoice.xmlContent).catch(err => {
            console.error('[createMyInvoice] saveXMLToDisk failed:', err.message);
        });
    }

    // 6.1. DT39 — Guardar RFCE en disco si aplica
    if (fullInvoice.rfce && fullInvoice.rfce.xmlContent) {
        const { saveXMLToDisk } = require('../../documents/storage/xml-storage');
        saveXMLToDisk(
            { ...fullInvoice.toJSON(), ncf: `${fullInvoice.ncf}-RFCE` },
            fullInvoice.rfce.xmlContent
        ).catch(err => {
            console.error('[createMyInvoice] saveXMLToDisk (RFCE) failed:', err.message);
        });
    }

    return buildInvoiceResponse(fullInvoice, {
        lineCount: fullInvoice.lines.length,
        hideXml: false
    });
}

module.exports = { createMyInvoice };