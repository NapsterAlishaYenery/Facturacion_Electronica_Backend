// ============================================================
// Template: invoice-rejected
//
// Caso de uso: job retry-failed-sends
//   → se agotaron los reintentos de envío a DGII
//   → la factura pasa a status='rejected'
//   → se notifica SOLO a Expedinap (problema técnico)
//
// API pública:
//   - buildSubject({ invoice, company }) → string
//   - render({ invoice, company, attempts, error }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

const MAX_ERROR_LENGTH = 500;

// ------------------------------------------------------------
// Formatear fecha larga (es-DO)
// ------------------------------------------------------------
function formatDate(date) {
    if (!date) return null;
    return new Date(date).toLocaleString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ------------------------------------------------------------
// Truncar strings largos (ej: XML de error de DGII)
// ------------------------------------------------------------
function truncate(value, maxLength = MAX_ERROR_LENGTH) {
    if (value === null || value === undefined) return null;
    const str = String(value);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '… [truncado]';
}

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ invoice, company } = {}) {
    const ncf = invoice?.ncf || 'desconocido';
    const companyName = company?.name || 'empresa desconocida';
    const attempts = invoice?.sendAttempts || '?';
    return `🔴 Factura rechazada tras ${attempts} intentos: ${ncf} — ${companyName}`;
}

// ------------------------------------------------------------
// Helper: fila de tabla HTML
// ------------------------------------------------------------
function row(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `
        <tr>
            <td style="color:${BRAND.mutedColor};padding:4px 12px 4px 0;font-size:13px;vertical-align:top;">${escapeHtml(label)}:</td>
            <td style="font-size:13px;padding:4px 0;"><strong>${escapeHtml(String(value))}</strong></td>
        </tr>`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ invoice, company, attempts, error } = {}) {
    // 1. Validaciones mínimas
    if (!invoice) throw new Error('invoiceRejected: invoice is required');
    if (!company) throw new Error('invoiceRejected: company is required');

    // 2. Subject
    const subject = buildSubject({ invoice, company });

    // 3. Sección: Empresa
    const empresaSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            🏢 Empresa
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Nombre', company.name)}
            ${row('RNC', company.rnc)}
            ${row('Email', company.email)}
        </table>`;

    // 4. Sección: Factura
    const total = invoice.total !== undefined && invoice.total !== null
        ? `RD$ ${Number(invoice.total).toFixed(2)}`
        : null;

    const facturaSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            📄 Factura
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('e-NCF', invoice.ncf)}
            ${row('Tipo', invoice.type)}
            ${row('Total', total)}
            ${row('Emitida', formatDate(invoice.issuedAt || invoice.createdAt))}
            ${row('Intentos de envío', attempts || invoice.sendAttempts)}
        </table>`;

    // 5. Sección: Error
    const truncatedError = truncate(error);
    const errorSection = truncatedError ? `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            ⚠️ Último error
        </h3>
        <pre style="background:#1f2937;color:#f87171;padding:12px 14px;border-radius:6px;font-family:'Courier New',monospace;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${escapeHtml(truncatedError)}</pre>` : '';

    // 6. Acciones sugeridas
    const actionsSection = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.6;">
                <strong>Acciones sugeridas:</strong><br>
                • Revisar los logs de la API de DGII<br>
                • Verificar el certificado digital de la empresa<br>
                • Si el problema persiste, contactar al cliente
            </div>
        </div>`;

    // 7. Body HTML
    const bodyHtml = `
        <p>Se ha agotado el número máximo de intentos para enviar una factura a la DGII. La factura ha sido marcada como <strong style="color:#dc2626;">rechazada</strong>.</p>
        ${empresaSection}
        ${facturaSection}
        ${errorSection}
        ${actionsSection}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:12px;">
            Correo interno automático. No responder.
        </p>`;

    // 8. Texto plano
    const text =
        `FACTURA RECHAZADA POR AGOTAMIENTO DE REINTENTOS\n\n` +
        `--- EMPRESA ---\n` +
        `Nombre: ${company.name}\n` +
        `RNC: ${company.rnc}\n` +
        (company.email ? `Email: ${company.email}\n` : '') +
        `\n--- FACTURA ---\n` +
        `e-NCF: ${invoice.ncf}\n` +
        `Tipo: ${invoice.type}\n` +
        (total ? `Total: ${total}\n` : '') +
        (formatDate(invoice.issuedAt || invoice.createdAt) ? `Emitida: ${formatDate(invoice.issuedAt || invoice.createdAt)}\n` : '') +
        `Intentos: ${attempts || invoice.sendAttempts}\n` +
        (truncatedError ? `\n--- ÚLTIMO ERROR ---\n${truncatedError}\n` : '') +
        `\n--- ACCIONES SUGERIDAS ---\n` +
        `• Revisar los logs de la API de DGII\n` +
        `• Verificar el certificado digital de la empresa\n` +
        `• Si el problema persiste, contactar al cliente\n\n` +
        `Correo interno automático.`;

    // 9. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };