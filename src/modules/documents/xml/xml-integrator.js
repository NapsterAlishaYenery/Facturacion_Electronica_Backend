// ============================================================
// Integrador XML — conecta invoices.service.js con xml-generator.js
//
// Responsabilidades:
//   1. Transformar el Invoice + InvoiceLine + Company + Sequence
//      en el objeto plano que el xml-generator espera.
//   2. Llamar al generador correcto según el tipo.
//   3. Persistir el XML en invoice.xml_content.
//
// IMPORTANTE: este integrador está preparado para los campos de
// los DT30-DT39. Usa optional chaining (?.) y nullish coalescing (??)
// para que no rompa si el modelo todavía no tiene las columnas.
// A medida que agregues las columnas, el integrador las leerá
// automáticamente.
// ============================================================

const {
    generateECF31,
    generateECF32,
    generateECF33,
    generateECF34,
    generateECF41,
    generateECF43,
    generateECF44,
    generateECF45,
    generateECF46,
    generateECF47
} = require('../../invoices/ecf/xml-generator');

const {
    Invoice,
    InvoiceLine,
    Sequence,
    Company,
    InvoiceSubtotal,
    InvoiceDiscountCharge,
    RfceDocument
} = require('../../../models');

const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Mapa de generadores por tipo
// ------------------------------------------------------------
const GENERATORS = {
    '31': generateECF31,
    '32': generateECF32,
    '33': generateECF33,
    '34': generateECF34,
    '41': generateECF41,
    '43': generateECF43,
    '44': generateECF44,
    '45': generateECF45,
    '46': generateECF46,
    '47': generateECF47
};

// ============================================================
// HELPERS: normalización de valores
// ============================================================

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

function toStringOrNull(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s === '' ? null : s;
}

function toDateOrNull(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza un JSONB de formas de pago al formato que el generator espera:
 * [{ formaPago: 1, montoPago: 100.00 }, ...]
 */
function normalizeFormasPago(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(pm => ({
            formaPago: Number(pm.formaPago ?? pm.method ?? 0),
            montoPago: Number(pm.montoPago ?? pm.amount ?? 0)
        }))
        .filter(pm => pm.formaPago > 0 && pm.montoPago >= 0)
        .slice(0, 7);
}

/**
 * Normaliza un JSONB de impuestos adicionales al formato que el generator espera:
 * [{ codigo, tasa, iscEspecifico, iscAdvalorem, otros }, ...]
 */
function normalizeImpuestosAdicionales(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(it => ({
            codigo: String(it.codigo ?? it.code ?? '').padStart(3, '0'),
            tasa: toNumberOrNull(it.tasa ?? it.rate),
            iscEspecifico: toNumberOrNull(it.iscEspecifico),
            iscAdvalorem: toNumberOrNull(it.iscAdvalorem),
            otros: toNumberOrNull(it.otros)
        }))
        .filter(it => it.codigo !== '000')
        .slice(0, 20);
}

/**
 * Normaliza un JSONB de subcantidades al formato que el generator espera:
 * [{ subcantidad, codigoSubcantidad }, ...]
 */
function normalizeSubcantidades(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(s => ({
            subcantidad: toNumberOrNull(s.subcantidad),
            codigoSubcantidad: toNumberOrNull(s.codigoSubcantidad)
        }))
        .filter(s => s.subcantidad !== null && s.codigoSubcantidad !== null)
        .slice(0, 5);
}

/**
 * Normaliza un JSONB de subdescuentos al formato que el generator espera:
 * [{ tipoSubDescuento: '$'|'%', subDescuentoPorcentaje, montoSubDescuento }, ...]
 */
function normalizeSubDescuentos(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(d => ({
            tipoSubDescuento: (d.tipoSubDescuento === '%' || d.tipoSubDescuento === '$') ? d.tipoSubDescuento : '$',
            subDescuentoPorcentaje: toNumberOrNull(d.subDescuentoPorcentaje),
            montoSubDescuento: toNumberOrNull(d.montoSubDescuento) ?? 0
        }))
        .slice(0, 12);
}

/**
 * Normaliza un JSONB de subrecargos al formato que el generator espera.
 */
function normalizeSubRecargos(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(r => ({
            tipoSubRecargo: (r.tipoSubRecargo === '%' || r.tipoSubRecargo === '$') ? r.tipoSubRecargo : '$',
            subRecargoPorcentaje: toNumberOrNull(r.subRecargoPorcentaje),
            montoSubRecargo: toNumberOrNull(r.montoSubRecargo) ?? 0
        }))
        .slice(0, 12);
}

/**
 * Normaliza un JSONB de impuestos adicionales por ítem al formato esperado:
 * [{ codigo }, ...]
 */
function normalizeItemImpuestosAdicionales(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(it => ({ codigo: String(it.codigo ?? it.code ?? '').padStart(3, '0') }))
        .filter(it => it.codigo !== '000')
        .slice(0, 2);
}

// ============================================================
// HELPERS: cálculo de paginación (si totalPaginas > 1)
// ============================================================

function calcularPaginas(lines, totalPaginas, linesPerPage = 20) {
    if (!totalPaginas || totalPaginas <= 1) return [];

    const paginas = [];
    for (let i = 0; i < totalPaginas; i++) {
        const from = i * linesPerPage;
        const to = Math.min((i + 1) * linesPerPage, lines.length);
        const pageLines = lines.slice(from, to);

        let montoGravadoTotal = 0, montoGravado1 = 0, montoGravado2 = 0, montoGravado3 = 0;
        let exento = 0, itbis = 0, itbis1 = 0, itbis2 = 0, itbis3 = 0;
        let noFacturable = 0;

        for (const line of pageLines) {
            const base = (line.quantity * line.unitPrice) - (line.discount || 0) + (line.recargo || 0);
            const ind = Number(line.indicadorFacturacion);

            if (ind === 1) { montoGravado1 += base; itbis1 += line.itbisAmount || 0; montoGravadoTotal += base; }
            else if (ind === 2) { montoGravado2 += base; itbis2 += line.itbisAmount || 0; montoGravadoTotal += base; }
            else if (ind === 3) { montoGravado3 += base; itbis3 += line.itbisAmount || 0; montoGravadoTotal += base; }
            else if (ind === 4) { exento += base; }
            else if (ind === 0) { noFacturable += base; }

            itbis += line.itbisAmount || 0;
        }

        const montoSubtotal = montoGravadoTotal + exento + itbis;

        paginas.push({
            paginaNo: i + 1,
            noLineaDesde: from + 1,
            noLineaHasta: to,
            subtotalMontoGravadoPagina: montoGravadoTotal,
            subtotalMontoGravado1Pagina: montoGravado1,
            subtotalMontoGravado2Pagina: montoGravado2,
            subtotalMontoGravado3Pagina: montoGravado3,
            subtotalExentoPagina: exento,
            subtotalItbisPagina: itbis,
            subtotalItbis1Pagina: itbis1,
            subtotalItbis2Pagina: itbis2,
            subtotalItbis3Pagina: itbis3,
            subtotalImpuestoAdicionalPagina: 0,
            subtotalIscEspecificoPagina: 0,
            subtotalOtrosImpuestosPagina: 0,
            montoSubtotalPagina: montoSubtotal,
            subtotalMontoNoFacturablePagina: noFacturable
        });
    }

    return paginas;
}

// ============================================================
// HELPER PRINCIPAL: Invoice + Lines + Company + Sequence → invoiceData
// ============================================================

function buildInvoiceDataForXML(invoice, lines, company, sequence = null) {
    const inv = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;
    const comp = typeof company.toJSON === 'function' ? company.toJSON() : company;
    const seq = sequence && typeof sequence.toJSON === 'function' ? sequence.toJSON() : sequence;

    // ---- Detectar qué bloques tienen datos ----
    const hasTransporte = !!(
        inv.transporteVia || inv.transporteConductor || inv.transportePlaca ||
        inv.transportePaisDestino || inv.transportePaisOrigen ||
        inv.transporteNumeroAlbaran
    );

    const hasInfoAdicional = !!(
        inv.infoFechaEmbarque || inv.infoNumeroEmbarque || inv.infoNumeroContenedor ||
        inv.infoNumeroReferencia || inv.infoPesoBruto || inv.infoPesoNeto ||
        inv.infoCantidadBulto || inv.infoVolumenBulto
    );

    // ---- Normalizar líneas ----
    const normalizedLines = lines.map(l => {
        const line = typeof l.toJSON === 'function' ? l.toJSON() : l;

        const itemName = line.itemName || line.description || 'Item';
        const description = line.description || null;

        return {
            // Identificación
            lineNumber: line.lineNumber,
            itemCode: line.itemCode || null,
            itemName,
            description,

            // Naturaleza DGII
            indicadorBienoServicio: Number(line.indicadorBienoServicio ?? 1),
            unidadMedida: toNumberOrNull(line.unidadMedida),

            // Cantidades y precios
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discount: Number(line.discount || 0),
            recargo: Number(line.recargo || 0),

            // Referencias opcionales
            cantidadReferencia: toNumberOrNull(line.cantidadReferencia),
            unidadReferencia: toNumberOrNull(line.unidadReferencia),
            gradosAlcohol: toNumberOrNull(line.gradosAlcohol),
            precioUnitarioReferencia: toNumberOrNull(line.precioUnitarioReferencia),

            // Fechas
            fechaElaboracion: line.fechaElaboracion || null,
            fechaVencimientoItem: line.fechaVencimientoItem || null,

            // TablaCodigosItem adicionales (DT31)
            additionalCodes: Array.isArray(line.additionalCodes) ? line.additionalCodes : [],

            // Minería (DT31)
            pesoNetoKilogramo: toNumberOrNull(line.pesoNetoKilogramo),
            pesoNetoMineria: toNumberOrNull(line.pesoNetoMineria),
            tipoAfiliacion: toNumberOrNull(line.tipoAfiliacion),
            liquidacion: toNumberOrNull(line.liquidacion),

            // Subcantidades (DT31)
            subcantidades: normalizeSubcantidades(line.subcantidades),

            // SubDescuentos / SubRecargos (DT31)
            subDescuentos: normalizeSubDescuentos(line.subDescuentos),
            subRecargos: normalizeSubRecargos(line.subRecargos),

            // Impuestos adicionales por ítem (DT31)
            impuestosAdicionales: normalizeItemImpuestosAdicionales(line.impuestosAdicionales),

            // ITBIS
            itbisRate: Number(line.itbisRate),
            itbisAmount: Number(line.itbisAmount),
            indicadorFacturacion: Number(line.indicadorFacturacion),
            total: Number(line.total),

            // Otra moneda detalle (DT31)
            precioOtraMoneda: toNumberOrNull(line.precioOtraMoneda),
            descuentoOtraMoneda: toNumberOrNull(line.descuentoOtraMoneda),
            recargoOtraMoneda: toNumberOrNull(line.recargoOtraMoneda),
            montoItemOtraMoneda: toNumberOrNull(line.montoItemOtraMoneda),

            // Retenciones por línea (41, 47)
            retencion: line.retencionIndicador
                ? {
                    indicador: Number(line.retencionIndicador),
                    montoItbisRetenido: toNumberOrNull(line.montoItbisRetenido) ?? 0,
                    montoIsrRetenido: toNumberOrNull(line.montoIsrRetenido) ?? 0
                }
                : null
        };
    });

    // ---- Normalizar subtotales ----
    const subtotalesRaw = inv.subtotales || [];
    const subtotales = subtotalesRaw.map(s => {
        const st = typeof s.toJSON === 'function' ? s.toJSON() : s;
        return {
            numeroSubtotal: Number(st.numeroSubtotal),
            descripcion: st.descripcion || null,
            orden: toNumberOrNull(st.orden),
            montoGravadoTotal: Number(st.montoGravadoTotal || 0),
            montoGravadoI1: Number(st.montoGravadoI1 || 0),
            montoGravadoI2: Number(st.montoGravadoI2 || 0),
            montoGravadoI3: Number(st.montoGravadoI3 || 0),
            subTotalItbis: Number(st.subTotalItbis || 0),
            subTotalItbis1: Number(st.subTotalItbis1 || 0),
            subTotalItbis2: Number(st.subTotalItbis2 || 0),
            subTotalItbis3: Number(st.subTotalItbis3 || 0),
            subTotalImpuestoAdicional: Number(st.subTotalImpuestoAdicional || 0),
            subTotalExento: Number(st.subTotalExento || 0),
            montoSubTotal: Number(st.montoSubTotal || 0),
            lineas: toNumberOrNull(st.lineas)
        };
    });

    // ---- Normalizar descuentos/recargos ----
    const descuentosRaw = inv.descuentosORecargos || [];
    const descuentosORecargos = descuentosRaw.map(d => {
        const dc = typeof d.toJSON === 'function' ? d.toJSON() : d;
        return {
            numeroLinea: Number(dc.numeroLinea),
            tipoAjuste: dc.tipoAjuste,
            indicadorNorma1007: toNumberOrNull(dc.indicadorNorma1007),
            descripcion: dc.descripcion || null,
            tipoValor: dc.tipoValor,
            valor: toNumberOrNull(dc.valor),
            monto: Number(dc.monto || 0),
            montoOtraMoneda: toNumberOrNull(dc.montoOtraMoneda),
            indicadorFacturacion: Number(dc.indicadorFacturacion)
        };
    });

    // ---- Paginación ----
    const totalPaginas = Number(inv.totalPaginas || 1);
    const paginas = calcularPaginas(normalizedLines, totalPaginas);

    // ---- Construir objeto final ----
    return {
        // ============ IdDoc ============
        ncf: inv.ncf,
        type: inv.type,
        issuedAt: inv.issuedAt,
        sequenceExpiresAt: seq?.expiresAt || null,

        indicadorNotaCredito: toNumberOrNull(inv.indicadorNotaCredito),
        indicadorEnvioDiferido: toNumberOrNull(inv.indicadorEnvioDiferido),
        indicadorMontoGravado: toNumberOrNull(inv.indicadorMontoGravado),
        indicadorServicioTodoIncluido: toNumberOrNull(inv.indicadorServicioTodoIncluido),

        tipoIngresos: inv.tipoIngresos || '01',
        tipoPago: toNumberOrNull(inv.tipoPago) ?? 1,
        fechaLimitePago: toDateOrNull(inv.fechaLimitePago),
        terminoPago: inv.terminoPago || null,
        formasPago: normalizeFormasPago(inv.formasPago),
        tipoCuentaPago: inv.tipoCuentaPago || null,
        numeroCuentaPago: inv.numeroCuentaPago || null,
        bancoPago: inv.bancoPago || null,
        fechaDesde: toDateOrNull(inv.fechaDesde),
        fechaHasta: toDateOrNull(inv.fechaHasta),
        totalPaginas,
        paginas,

        // ============ Emisor ============
        issuerRnc: comp.rnc,
        issuerName: comp.name,
        issuerTradeName: comp.tradeName || null,
        issuerSucursal: comp.sucursal || null,
        issuerAddress: comp.address || null,
        issuerMunicipio: comp.municipalityDgiiCode || null,
        issuerProvincia: comp.provinceDgiiCode || null,
        issuerPhone: comp.phone || null,
        issuerPhones: Array.isArray(comp.additionalPhones) ? comp.additionalPhones : [],
        issuerEmail: comp.email || null,
        issuerWebsite: comp.website || null,
        issuerEconomicActivity: comp.economicActivity || null,

        // Emisor — campos de la factura (no de Company)
        codigoVendedor: inv.codigoVendedor || null,
        numeroFacturaInterna: inv.numeroFacturaInterna || null,
        numeroPedidoInterno: inv.numeroPedidoInterno || null,
        zonaVenta: inv.zonaVenta || null,
        rutaVenta: inv.rutaVenta || null,
        informacionAdicionalEmisor: inv.informacionAdicionalEmisor || null,

        // ============ Comprador ============
        receiverRnc: inv.receiverRnc || null,
        receiverName: inv.receiverName || null,
        receiverIdentificadorExtranjero: inv.receiverIdentificadorExtranjero || null,
        receiverPais: inv.receiverPais || null,

        contactoComprador: inv.contactoComprador || null,
        correoComprador: inv.correoComprador || null,
        direccionComprador: inv.direccionComprador || null,
        municipioComprador: inv.municipioComprador || null,
        provinciaComprador: inv.provinciaComprador || null,

        fechaEntrega: toDateOrNull(inv.fechaEntrega),
        contactoEntrega: inv.contactoEntrega || null,
        direccionEntrega: inv.direccionEntrega || null,
        telefonoAdicional: inv.telefonoAdicional || null,
        fechaOrdenCompra: toDateOrNull(inv.fechaOrdenCompra),
        numeroOrdenCompra: inv.numeroOrdenCompra || null,
        codigoInternoComprador: inv.codigoInternoComprador || null,
        responsablePago: inv.responsablePago || null,
        informacionAdicionalComprador: inv.informacionAdicionalComprador || null,

        // ============ Totales ============
        subtotal: Number(inv.subtotal),
        itbis: Number(inv.itbis),
        total: Number(inv.total),
        montoGravado: Number(inv.montoGravado || 0),
        itbis1Base: Number(inv.itbis1Base || 0),
        itbis1Amount: Number(inv.itbis1Amount || 0),
        itbis2Base: Number(inv.itbis2Base || 0),
        itbis2Amount: Number(inv.itbis2Amount || 0),
        itbis3Base: Number(inv.itbis3Base || 0),
        itbis3Amount: Number(inv.itbis3Amount || 0),
        exemptAmount: Number(inv.exemptAmount || 0),

        montoImpuestoAdicional: Number(inv.montoImpuestoAdicional || 0),
        impuestosAdicionales: normalizeImpuestosAdicionales(inv.impuestosAdicionales),

        montoNoFacturable: toNumberOrNull(inv.montoNoFacturable),
        montoPeriodo: toNumberOrNull(inv.montoPeriodo),
        saldoAnterior: toNumberOrNull(inv.saldoAnterior),
        montoAvancePago: toNumberOrNull(inv.montoAvancePago),
        valorPagar: toNumberOrNull(inv.valorPagar),

        totalItbisRetenido: Number(inv.totalItbisRetenido || 0),
        totalIsrRetencion: Number(inv.totalIsrRetencion || 0),
        totalItbisPercepcion: Number(inv.totalItbisPercepcion || 0),
        totalIsrPercepcion: Number(inv.totalIsrPercepcion || 0),

        // ============ Otra moneda (encabezado) ============
        tipoMoneda: inv.tipoMoneda || null,
        tipoCambio: toNumberOrNull(inv.tipoCambio),
        montoGravadoTotalOtraMoneda: toNumberOrNull(inv.montoGravadoTotalOtraMoneda),
        montoGravado1OtraMoneda: toNumberOrNull(inv.montoGravado1OtraMoneda),
        montoGravado2OtraMoneda: toNumberOrNull(inv.montoGravado2OtraMoneda),
        montoGravado3OtraMoneda: toNumberOrNull(inv.montoGravado3OtraMoneda),
        montoExentoOtraMoneda: toNumberOrNull(inv.montoExentoOtraMoneda),
        totalItbisOtraMoneda: toNumberOrNull(inv.totalItbisOtraMoneda),
        totalItbis1OtraMoneda: toNumberOrNull(inv.totalItbis1OtraMoneda),
        totalItbis2OtraMoneda: toNumberOrNull(inv.totalItbis2OtraMoneda),
        totalItbis3OtraMoneda: toNumberOrNull(inv.totalItbis3OtraMoneda),
        montoImpuestoAdicionalOtraMoneda: toNumberOrNull(inv.montoImpuestoAdicionalOtraMoneda),
        impuestosAdicionalesOtraMoneda: normalizeImpuestosAdicionales(inv.impuestosAdicionalesOtraMoneda),
        montoTotalOtraMoneda: toNumberOrNull(inv.montoTotalOtraMoneda),

        // ============ Líneas ============
        lines: normalizedLines,

        // ============ Transporte ============
        transporte: hasTransporte
            ? {
                viaTransporte: inv.transporteVia || null,
                paisOrigen: inv.transportePaisOrigen || null,
                direccionDestino: inv.transporteDireccionDestino || null,
                paisDestino: inv.transportePaisDestino || null,
                rncCompaniaTransportista: inv.transporteRncCompania || null,
                nombreCompaniaTransportista: inv.transporteNombreCompania || null,
                numeroViaje: inv.transporteNumeroViaje || null,
                conductor: inv.transporteConductor || null,
                documentoTransporte: inv.transporteDocumento || null,
                ficha: inv.transporteFicha || null,
                placa: inv.transportePlaca || null,
                rutaTransporte: inv.transporteRuta || null,
                zonaTransporte: inv.transporteZona || null,
                numeroAlbaran: inv.transporteNumeroAlbaran || null
            }
            : null,

        // ============ Informaciones adicionales ============
        informacionesAdicionales: hasInfoAdicional
            ? {
                fechaEmbarque: toDateOrNull(inv.infoFechaEmbarque),
                numeroEmbarque: inv.infoNumeroEmbarque || null,
                numeroContenedor: inv.infoNumeroContenedor || null,
                numeroReferencia: inv.infoNumeroReferencia || null,
                nombrePuertoEmbarque: inv.infoNombrePuertoEmbarque || null,
                condicionesEntrega: inv.infoCondicionesEntrega || null,
                totalFob: toNumberOrNull(inv.infoTotalFob),
                seguro: toNumberOrNull(inv.infoSeguro),
                flete: toNumberOrNull(inv.infoFlete),
                otrosGastos: toNumberOrNull(inv.infoOtrosGastos),
                totalCif: toNumberOrNull(inv.infoTotalCif),
                regimenAduanero: inv.infoRegimenAduanero || null,
                nombrePuertoSalida: inv.infoNombrePuertoSalida || null,
                nombrePuertoDesembarque: inv.infoNombrePuertoDesembarque || null,
                pesoBruto: toNumberOrNull(inv.infoPesoBruto),
                pesoNeto: toNumberOrNull(inv.infoPesoNeto),
                unidadPesoBruto: toNumberOrNull(inv.infoUnidadPesoBruto),
                unidadPesoNeto: toNumberOrNull(inv.infoUnidadPesoNeto),
                cantidadBulto: toNumberOrNull(inv.infoCantidadBulto),
                unidadBulto: toNumberOrNull(inv.infoUnidadBulto),
                volumenBulto: toNumberOrNull(inv.infoVolumenBulto),
                unidadVolumen: toNumberOrNull(inv.infoUnidadVolumen)
            }
            : null,

        // ============ Subtotales / Descuentos / Paginación ============
        subtotales,
        descuentosORecargos,

        // ============ Notas 33/34 ============
        modifiedNcf: inv.modifiedNcf || null,
        modifiedNcfIssuerRnc: inv.modifiedNcfIssuerRnc || null,
        modifiedNcfDate: toDateOrNull(inv.modifiedNcfDate),
        modificationCode: toNumberOrNull(inv.modificationCode),
        modificationReason: inv.modificationReason || null,

        // ============ Seguridad (para RFCE y QR) ============
        codigoSeguridadeCF: inv.codigoSeguridadeCF || null
    };
}

// ============================================================
// HELPER: llamar al generador correcto según el tipo
// ============================================================

function generateXMLForType(invoiceData, type) {
    const typeStr = String(type);
    const generator = GENERATORS[typeStr];

    if (!generator) {
        throw new AppError(
            `No XML generator available for e-CF type ${typeStr}`,
            500,
            'INVALID_ECF_TYPE'
        );
    }

    return generator(invoiceData);
}

// ============================================================
// HELPER: cargar factura completa (con todas las relaciones nuevas)
// ============================================================

async function loadFullInvoice(invoiceId, transaction = null) {
    const include = [
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
            model: Company,
            as: 'company',
            attributes: [
                'id', 'rnc', 'name', 'tradeName',
                'email', 'phone', 'address', 'economicActivity',
                'provinceDgiiCode', 'municipalityDgiiCode',
                'sucursal', 'website', 'additionalPhones'
            ].filter(Boolean)
        }
    ];

    // Agregar includes opcionales solo si los modelos existen
    if (InvoiceSubtotal) {
        include.push({
            model: InvoiceSubtotal,
            as: 'subtotales',
            separate: true,
            order: [['numeroSubtotal', 'ASC']]
        });
    }
    if (InvoiceDiscountCharge) {
        include.push({
            model: InvoiceDiscountCharge,
            as: 'descuentosORecargos',
            separate: true,
            order: [['numeroLinea', 'ASC']]
        });
    }

    return Invoice.findByPk(invoiceId, { include, transaction });
}

// ============================================================
// FUNCIÓN PRINCIPAL: generar y persistir XML
// ============================================================

async function generateAndSaveInvoiceXML(invoiceId, transaction = null) {
    const invoice = await loadFullInvoice(invoiceId, transaction);

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }
    if (!invoice.lines || invoice.lines.length === 0) {
        throw new AppError(
            'Cannot generate XML: invoice has no lines',
            500,
            'INVOICE_HAS_NO_LINES'
        );
    }
    if (!invoice.company) {
        throw new AppError(
            'Cannot generate XML: company not found',
            500,
            'COMPANY_NOT_FOUND'
        );
    }

    const invoiceData = buildInvoiceDataForXML(
        invoice,
        invoice.lines,
        invoice.company,
        invoice.sequence
    );

    const xmlContent = generateXMLForType(invoiceData, invoice.type);

    await invoice.update({ xmlContent }, { transaction });

    return { invoice, xmlContent, invoiceData };
}



// ============================================================
// DT39 — Generar y persistir el RFCE
// ============================================================
/**
 * Genera el RFCE para un invoice tipo 32 < 250,000.
 *
 * - Si el invoice NO cumple la condición (type != 32 o total >= 250K),
 *   no hace nada y retorna null.
 * - Si cumple, genera el XML del RFCE con codigoSeguridad='000000'
 *   (placeholder hasta que el e-CF 32 se firme) y lo persiste en
 *   `rfce_documents`.
 * - Si ya existía un RFCE para este invoice, se actualiza el XML
 *   y se respeta el status (no se degrada 'signed' → 'draft').
 *
 * @param {string} invoiceId
 * @param {Transaction} transaction
 * @returns {Promise<RfceDocument|null>}
 */
async function generateAndSaveRFCE(invoiceId, transaction = null) {
    const invoice = await Invoice.findByPk(invoiceId, {
        include: [
            { model: InvoiceLine, as: 'lines', separate: true, order: [['lineNumber', 'ASC']] },
            { model: Sequence, as: 'sequence' },
            { model: Company, as: 'company' }
        ],
        transaction
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // Condición: type=32 y total < 250,000
    const totalNum = Number(invoice.total);
    const isRFCE = String(invoice.type) === '32' && totalNum < 250000;

    if (!isRFCE) {
        return null;
    }

    // Construir invoiceData con el mismo helper que el e-CF
    const invoiceData = buildInvoiceDataForXML(
        invoice,
        invoice.lines,
        invoice.company,
        invoice.sequence
    );

    // Generar el XML del RFCE con placeholder de código de seguridad
    const { buildRFCE } = require('../../invoices/ecf/xml-generator');
    const rfceXml = buildRFCE(invoiceData, '000000');

    // Upsert: si ya existe el RFCE, actualizar; si no, crear
    const [rfce, created] = await RfceDocument.findOrCreate({
        where: { invoiceId: invoice.id },
        defaults: {
            invoiceId: invoice.id,
            xmlContent: rfceXml,
            codigoSeguridad: '000000',
            status: 'draft'
        },
        transaction
    });

    if (!created) {
        // Ya existía → actualizar el XML y el código
        // No degradar status: si estaba 'signed', 'sent', etc., se respeta.
        await rfce.update({
            xmlContent: rfceXml,
            codigoSeguridad: '000000'
        }, { transaction });
    }

    return rfce;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    buildInvoiceDataForXML,
    generateXMLForType,
    generateAndSaveInvoiceXML,
    generateAndSaveRFCE,
    loadFullInvoice,
    // Helpers exportados para testing
    _helpers: {
        toNumberOrNull,
        toStringOrNull,
        toDateOrNull,
        normalizeFormasPago,
        normalizeImpuestosAdicionales,
        normalizeSubcantidades,
        normalizeSubDescuentos,
        normalizeSubRecargos,
        normalizeItemImpuestosAdicionales,
        calcularPaginas
    }
};