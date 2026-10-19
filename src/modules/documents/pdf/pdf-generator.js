// ============================================================
// Generador de PDF desde Invoice
//
// Usa Puppeteer (Chromium headless) + Handlebars + qrcode.
// Soporta 3 formatos: a4 (default), ticket (80mm), half (media carta).
//
// No guarda nada en BD ni disco — solo devuelve el buffer.
// El caché lo maneja pdf-storage.js.
// ============================================================

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

const { buildQRCodeData, extractSecurityCode } = require('../../invoices/ecf/xml-generator');

// ------------------------------------------------------------
// Configuración de formatos
// ------------------------------------------------------------
const FORMATS = {
    a4: {
        template: 'invoice-template-a4.html',
        pdfOptions: {
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '12mm',
                bottom: '15mm',
                left: '12mm'
            }
        }
    },
    ticket: {
        template: 'invoice-template-ticket.html',
        pdfOptions: {
            width: '80mm',
            printBackground: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            }
        }
    },
    half: {
        template: 'invoice-template-half.html',
        pdfOptions: {
            width: '216mm',
            height: '140mm',
            printBackground: true,
            margin: {
                top: '8mm',
                right: '10mm',
                bottom: '8mm',
                left: '10mm'
            }
        }
    }
};

const DEFAULT_FORMAT = 'a4';

// ------------------------------------------------------------
// Singleton del browser
// ------------------------------------------------------------
let browserInstance = null;

async function getBrowser() {
    if (!browserInstance || !browserInstance.connected) {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
    }
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

// ------- helpers -------

// ------------------------------------------------------------
// Registrar helpers de Handlebars
// ------------------------------------------------------------
Handlebars.registerHelper('formatMoney', (value) => {
    const num = Number(value || 0).toFixed(2);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
});

Handlebars.registerHelper('formatDate', (value) => {
    if (!value) return '';
    const d = new Date(value);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
});

Handlebars.registerHelper('eq', (a, b) => a === b);

// ------------------------------------------------------------
// Cache de templates compilados (uno por formato)
// ------------------------------------------------------------
const templateCache = {};

async function getTemplate(format) {
    if (templateCache[format]) return templateCache[format];

    const config = FORMATS[format];
    if (!config) {
        throw new Error(`Unsupported PDF format: ${format}`);
    }

    const templatePath = path.join(__dirname, config.template);
    const html = await fs.readFile(templatePath, 'utf8');
    templateCache[format] = Handlebars.compile(html);

    return templateCache[format];
}

// ------------------------------------------------------------
// Valida el formato
// ------------------------------------------------------------
function isValidFormat(format) {
    return Object.prototype.hasOwnProperty.call(FORMATS, format);
}

function normalizeFormat(format) {
    const f = String(format || DEFAULT_FORMAT).toLowerCase();
    return isValidFormat(f) ? f : DEFAULT_FORMAT;
}

// ------------------------------------------------------------
// Construye el payload para el template
// ------------------------------------------------------------
async function buildTemplateData(invoice, lines, company) {
    const type = String(invoice.type);
    const isNota = type === '33' || type === '34';
    const isExportacion = type === '46';
    const isPagoExterior = type === '47';
    const hasBuyer = type !== '43';
    const hasRetenciones = type === '41' || type === '47';

    const securityCode = invoice.xmlSigned
        ? extractSecurityCode(invoice.xmlSigned)
        : '';

    const qrUrl = buildQRCodeData({
        issuerRnc: invoice.issuerRnc,
        ncf: invoice.ncf,
        receiverRnc: invoice.receiverRnc,
        total: Number(invoice.total),
        issuedAt: invoice.issuedAt,
        type,
        signedAt: invoice.updatedAt,
        securityCode
    });

    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
    });

    const typeNames = {
        '31': 'Factura de Crédito Fiscal Electrónica',
        '32': 'Factura de Consumo Electrónica',
        '33': 'Nota de Débito Electrónica',
        '34': 'Nota de Crédito Electrónica',
        '41': 'Comprobante de Compras Electrónico',
        '43': 'Comprobante de Gastos Menores Electrónico',
        '44': 'Comprobante de Regímenes Especiales Electrónico',
        '45': 'Comprobante Gubernamental Electrónico',
        '46': 'Comprobante de Exportaciones Electrónico',
        '47': 'Comprobante para Pagos al Exterior Electrónico'
    };

    const statusNames = {
        'draft': 'Borrador',
        'signed': 'Firmada',
        'sent': 'Enviada a DGII',
        'accepted': 'Aceptada por DGII',
        'rejected': 'Rechazada por DGII',
        'contingency': 'Contingencia'
    };

    const formattedLines = lines.map(l => {
        const line = typeof l.toJSON === 'function' ? l.toJSON() : l;
        return {
            lineNumber: line.lineNumber,
            itemCode: line.itemCode,
            description: line.description,
            quantity: Number(line.quantity).toFixed(2),
            unitPrice: Number(line.unitPrice).toFixed(2),
            discount: Number(line.discount || 0).toFixed(2),
            hasDiscount: Number(line.discount) > 0,
            itbisRate: Number(line.itbisRate),
            itbisAmount: Number(line.itbisAmount).toFixed(2),
            total: Number(line.total).toFixed(2)
        };
    });

    // Extraer el logo invoice (si existe). El include en getMyInvoicePDF
    // ya filtró por purpose: 'invoice' con required: false, así que:
    // - company.logos es siempre un array (vacío o con 1 elemento).
    // - Si no hay logo, invoiceLogo es null y el template no lo renderiza.
    const invoiceLogo = Array.isArray(company.logos) && company.logos.length > 0
        ? company.logos[0]
        : null;

    return {
        type,
        typeName: typeNames[type] || `e-CF ${type}`,
        ncf: invoice.ncf,
        status: invoice.status,
        statusName: statusNames[invoice.status] || invoice.status,

        issuerRnc: company.rnc,
        issuerName: company.name,
        issuerTradeName: company.tradeName,
        issuerAddress: company.address,
        issuerPhone: company.phone,
        issuerEmail: company.email,
        issuerEconomicActivity: company.economicActivity,

        // Logo (opcional). Si no existe, el template no lo renderiza.
        logoUrl: invoiceLogo?.secureUrl || null,
        logoWidth: invoiceLogo?.width || null,
        logoHeight: invoiceLogo?.height || null,

        hasBuyer,
        receiverRnc: invoice.receiverRnc,
        receiverName: invoice.receiverName,
        receiverIdentificadorExtranjero: invoice.receiverIdentificadorExtranjero,
        receiverPais: invoice.receiverPais,

        issuedAt: invoice.issuedAt,

        isNota,
        isExportacion,
        isPagoExterior,
        hasRetenciones,

        modifiedNcf: invoice.modifiedNcf,
        modifiedNcfDate: invoice.modifiedNcfDate,
        modificationCode: invoice.modificationCode,
        modificationReason: invoice.modificationReason,

        transporte: {
            via: invoice.transporteVia,
            paisOrigen: invoice.transportePaisOrigen,
            paisDestino: invoice.transportePaisDestino,
            direccionDestino: invoice.transporteDireccionDestino,
            compania: invoice.transporteNombreCompania,
            conductor: invoice.transporteConductor,
            placa: invoice.transportePlaca
        },

        infoAdicional: {
            fechaEmbarque: invoice.infoFechaEmbarque,
            numeroEmbarque: invoice.infoNumeroEmbarque,
            numeroContenedor: invoice.infoNumeroContenedor,
            puertoEmbarque: invoice.infoNombrePuertoEmbarque,
            condicionesEntrega: invoice.infoCondicionesEntrega,
            totalFob: invoice.infoTotalFob,
            seguro: invoice.infoSeguro,
            flete: invoice.infoFlete,
            totalCif: invoice.infoTotalCif,
            regimenAduanero: invoice.infoRegimenAduanero
        },

        lines: formattedLines,

        subtotal: Number(invoice.subtotal).toFixed(2),
        itbis: Number(invoice.itbis).toFixed(2),
        exemptAmount: invoice.exemptAmount ? Number(invoice.exemptAmount).toFixed(2) : null,
        totalItbisRetenido: invoice.totalItbisRetenido ? Number(invoice.totalItbisRetenido).toFixed(2) : null,
        totalIsrRetencion: invoice.totalIsrRetencion ? Number(invoice.totalIsrRetencion).toFixed(2) : null,
        total: Number(invoice.total).toFixed(2),

        qrDataUrl,
        qrUrl,
        securityCode,

        generatedAt: new Date()
    };
}

// ------- module functions -------

// ------------------------------------------------------------
// Genera el PDF de una factura.
//
// Params:
//   invoice  - instancia de Invoice (con companyId, type, ncf, etc)
//   lines    - array de InvoiceLine
//   company  - instancia de Company (emisor)
//   format   - 'a4' | 'ticket' | 'half' (default: 'a4')
//
// Devuelve un Buffer con el PDF.
// ------------------------------------------------------------
async function generateInvoicePDF(invoice, lines, company, format = DEFAULT_FORMAT) {
    if (!invoice || !lines || !company) {
        throw new Error('generateInvoicePDF: invoice, lines y company son requeridos');
    }

    const normalizedFormat = normalizeFormat(format);
    const config = FORMATS[normalizedFormat];

    // 1. Data para el template
    const data = await buildTemplateData(invoice, lines, company);

    // 2. Render HTML
    const template = await getTemplate(normalizedFormat);
    const html = template(data);

    // 3. Puppeteer → PDF
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf(config.pdfOptions);

        // Puppeteer v22+ devuelve Uint8Array; aseguramos Buffer de Node
        return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    } finally {
        await page.close();
    }
}

module.exports = {
    generateInvoicePDF,
    closeBrowser,
    buildTemplateData,
    isValidFormat,
    normalizeFormat,
    FORMATS
};