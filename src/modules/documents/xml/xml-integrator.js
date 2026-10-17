// ============================================================
// Integrador XML — conecta invoices.service.js con xml-generator.js
//
// Responsabilidades:
//   1. Transformar el Invoice + InvoiceLine + Company en el
//      objeto plano que el xml-generator espera.
//   2. Llamar al generador correcto según el tipo.
//   3. Persistir el XML en invoice.xml_content
//
// NO genera el XML directamente. Delega al xml-generator (Fase 4).
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

const { Invoice, InvoiceLine, Sequence, Company } = require('../../../models');
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

// ------- helpers -------

// ------------------------------------------------------------
// Helper: transforma Invoice + Lines + Company en el objeto
// plano que el generador espera.
// ------------------------------------------------------------
function buildInvoiceDataForXML(invoice, lines, company, sequence = null) {
    // 1. Convertir instancias de Sequelize a objetos planos
    const inv = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;
    const comp = typeof company.toJSON === 'function' ? company.toJSON() : company;
    const seq = sequence && typeof sequence.toJSON === 'function' ? sequence.toJSON() : sequence;

    // 2. Determinar qué bloques tienen datos (transporte, info adicional)
    const hasTransporte = !!(inv.transporteVia || inv.transporteConductor || inv.transportePlaca);
    const hasInfoAdicional = !!(inv.infoFechaEmbarque || inv.infoNumeroEmbarque || inv.infoNumeroContenedor);

    // 3. Construir objeto
    return {
        // --- IdDoc ---
        ncf: inv.ncf,
        type: inv.type,
        sequenceExpiresAt: seq?.expiresAt || null,
        paymentType: 1,
        issuedAt: inv.issuedAt,

        // --- Emisor ---
        issuerRnc: comp.rnc,
        issuerName: comp.name,
        issuerTradeName: comp.tradeName || null,
        issuerAddress: comp.address || null,
        issuerMunicipio: null,       // ← no existe en Company
        issuerProvincia: null,       // ← no existe en Company
        issuerPhone: comp.phone || null,
        issuerEmail: comp.email || null,
        issuerWebsite: null,         // ← no existe en Company
        issuerEconomicActivity: comp.economicActivity || null,

        // --- Comprador ---
        receiverRnc: inv.receiverRnc || null,
        receiverName: inv.receiverName || null,
        receiverIdentificadorExtranjero: inv.receiverIdentificadorExtranjero || null,
        receiverPais: inv.receiverPais || null,

        // --- Totales ---
        subtotal: Number(inv.subtotal),
        itbis: Number(inv.itbis),
        exemptAmount: inv.exemptAmount ? Number(inv.exemptAmount) : 0,
        itbis3Base: inv.itbis3Base ? Number(inv.itbis3Base) : 0,
        itbis3Amount: inv.itbis3Amount ? Number(inv.itbis3Amount) : 0,
        totalItbisRetenido: inv.totalItbisRetenido ? Number(inv.totalItbisRetenido) : 0,
        totalIsrRetencion: inv.totalIsrRetencion ? Number(inv.totalIsrRetencion) : 0,
        total: Number(inv.total),
        montoGravado: inv.montoGravado ? Number(inv.montoGravado) : 0,
        itbis1Base: inv.itbis1Base ? Number(inv.itbis1Base) : 0,
        itbis1Amount: inv.itbis1Amount ? Number(inv.itbis1Amount) : 0,
        itbis2Base: inv.itbis2Base ? Number(inv.itbis2Base) : 0,
        itbis2Amount: inv.itbis2Amount ? Number(inv.itbis2Amount) : 0,

        // --- Líneas ---
        lines: lines.map(l => {
            const line = typeof l.toJSON === 'function' ? l.toJSON() : l;
            return {
                lineNumber: line.lineNumber,
                itemCode: line.itemCode || null,
                description: line.description,
                quantity: Number(line.quantity),
                unitPrice: Number(line.unitPrice),
                discount: Number(line.discount || 0),
                itbisRate: Number(line.itbisRate),
                itbisAmount: Number(line.itbisAmount),
                indicadorFacturacion: Number(line.indicadorFacturacion), 
                total: Number(line.total),
                retencion: line.retencionIndicador ? {
                    indicador: line.retencionIndicador,
                    montoItbisRetenido: Number(line.montoItbisRetenido || 0),
                    montoIsrRetenido: Number(line.montoIsrRetenido || 0)
                } : null
            };
        }),

        // --- Transporte (solo si hay datos) ---
        transporte: hasTransporte ? {
            viaTransporte: inv.transporteVia,
            paisOrigen: inv.transportePaisOrigen,
            direccionDestino: inv.transporteDireccionDestino,
            paisDestino: inv.transportePaisDestino,
            rncCompaniaTransportista: inv.transporteRncCompania,
            nombreCompaniaTransportista: inv.transporteNombreCompania,
            numeroViaje: inv.transporteNumeroViaje,
            conductor: inv.transporteConductor,
            documentoTransporte: inv.transporteDocumento,
            ficha: inv.transporteFicha,
            placa: inv.transportePlaca,
            rutaTransporte: inv.transporteRuta,
            zonaTransporte: inv.transporteZona,
            numeroAlbaran: inv.transporteNumeroAlbaran
        } : null,

        // --- Informaciones adicionales (solo si hay datos) ---
        informacionesAdicionales: hasInfoAdicional ? {
            fechaEmbarque: inv.infoFechaEmbarque,
            numeroEmbarque: inv.infoNumeroEmbarque,
            numeroContenedor: inv.infoNumeroContenedor,
            nombrePuertoEmbarque: inv.infoNombrePuertoEmbarque,
            condicionesEntrega: inv.infoCondicionesEntrega,
            totalFob: inv.infoTotalFob ? Number(inv.infoTotalFob) : null,
            seguro: inv.infoSeguro ? Number(inv.infoSeguro) : null,
            flete: inv.infoFlete ? Number(inv.infoFlete) : null,
            otrosGastos: inv.infoOtrosGastos ? Number(inv.infoOtrosGastos) : null,
            totalCif: inv.infoTotalCif ? Number(inv.infoTotalCif) : null,
            regimenAduanero: inv.infoRegimenAduanero,
            nombrePuertoSalida: inv.infoNombrePuertoSalida,
            nombrePuertoDesembarque: inv.infoNombrePuertoDesembarque
        } : null,

        // --- Notas 33/34 ---
        modifiedNcf: inv.modifiedNcf || null,
        modifiedNcfIssuerRnc: inv.modifiedNcfIssuerRnc || null,
        modifiedNcfDate: inv.modifiedNcfDate,
        modificationCode: inv.modificationCode,
        modificationReason: inv.modificationReason || null,
        indicadorNotaCredito: inv.indicadorNotaCredito
    };
}

// ------------------------------------------------------------
// Helper: llama al generador correcto según el tipo.
// ------------------------------------------------------------
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

// ------- module functions -------

// ------------------------------------------------------------
// Genera y persiste el XML de una factura.
//
// Uso (dentro de una transacción):
//   await generateAndSaveInvoiceXML(invoice.id, transaction);
//
// Carga invoice + lines + sequence + company, construye
// invoiceData, genera el XML, y actualiza invoice.xml_content.
//
// Devuelve { invoice, xmlContent } para el caller.
// ------------------------------------------------------------
async function generateAndSaveInvoiceXML(invoiceId, transaction = null) {
    // 1. Cargar factura completa
    const invoice = await Invoice.findByPk(invoiceId, {
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
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity']
            }
        ],
        transaction
    });

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

    // 2. Construir invoiceData
    const invoiceData = buildInvoiceDataForXML(
        invoice,
        invoice.lines,
        invoice.company,
        invoice.sequence
    );

    // 3. Generar XML
    const xmlContent = generateXMLForType(invoiceData, invoice.type);

    // 4. Persistir en BD
    await invoice.update({ xmlContent }, { transaction });

    return { invoice, xmlContent };
}

module.exports = {
    buildInvoiceDataForXML,
    generateXMLForType,
    generateAndSaveInvoiceXML
};