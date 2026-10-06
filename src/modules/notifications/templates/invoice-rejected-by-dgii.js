// ============================================================
// Template: invoice-rejected-by-dgii
//
// Caso de uso: job poll-pending-status
//   → DGII RECHAZA una factura enviada
//   → notificación al owner + company + bcc Expedinap
//
// ⚠️ Distinto de invoice-rejected.js (Step 6.10):
//    - invoice-rejected.js (6.10) = alerta INTERNA cuando se
//      agotan los reintentos de envío (problema técnico).
//    - invoice-rejected-by-dgii.js (6.11) = aviso al dueño
//      cuando la DGII rechaza una factura ya enviada (problema
//      de negocio, requiere corrección).
//
// API pública:
//   - buildSubject({ invoice, company }) → string
//   - render({ invoice, company, reason }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Formatear fecha larga (es-DO)
// ------------------------------------------------------------
function formatDate(date) {
    if (!date) return null;
    return new Date(date).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ invoice, company } = {}) {
    const ncf = invoice?.ncf || 'desconocido';
    const companyName = company?.name || 'tu empresa';
    return `🔴 Factura ${ncf} rechazada por DGII — ${companyName}`;
}

// ------------------------------------------------------------
// Helper: fila de tabla HTML
// ------------------------------------------------------------
function row(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `
        <tr>
            <td style="color:${BRAND.mutedColor};padding:6px 12px 6px 0;font-size:14px;vertical-align:top;">${escapeHtml(label)}:</td>
            <td style="font-size:14px;padding:6px 0;"><strong>${escapeHtml(String(value))}</strong></td>
        </tr>`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ invoice, company, reason } = {}) {
    // 1. Validaciones mínimas
    if (!invoice) throw new Error('invoiceRejectedByDgii: invoice is required');
    if (!company) throw new Error('invoiceRejectedByDgii: company is required');

    // 2. Subject
    const subject = buildSubject({ invoice, company });

    // 3. Datos escapados
    const safeNcf = escapeHtml(invoice.ncf || '');
    const safeType = escapeHtml(invoice.type || '');
    const safeTotal = invoice.total !== undefined && invoice.total !== null
        ? `RD$ ${Number(invoice.total).toFixed(2)}`
        : null;
    const safeIssuedAt = formatDate(invoice.issuedAt || invoice.createdAt);
    const safeCompany = escapeHtml(company.name);
    const safeRnc = company.rnc ? escapeHtml(company.rnc) : null;
    const safeReason = reason ? escapeHtml(String(reason)) : null;

    // 4. Bloque de datos de la factura
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('e-NCF', safeNcf)}
                ${row('Tipo', safeType)}
                ${safeTotal ? row('Total', safeTotal) : ''}
                ${safeIssuedAt ? row('Emitida', safeIssuedAt) : ''}
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
            </table>
        </div>`;

    // 5. Bloque de rechazo
    const rejectBlock = `
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#991b1b;font-weight:bold;margin-bottom:8px;">
                🔴 La DGII rechazó esta factura
            </div>
            ${safeReason ? `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                <strong>Motivo:</strong> ${safeReason}
            </div>` : `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                Revisa el detalle del rechazo en el sistema.
            </div>`}
        </div>`;

    // 6. Acciones sugeridas
    const actionsBlock = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.7;">
                <strong>¿Qué debes hacer?</strong><br>
                • Revisa el detalle del rechazo en el sistema<br>
                • Corrige los datos señalados (RNC, montos, formato, etc.)<br>
                • Emite una nueva factura corregida<br>
                • Si no estás seguro del error, contacta a soporte
            </div>
        </div>`;

    // 7. Body HTML
    const bodyHtml = `
        <p>Hola,</p>
        <p>La DGII ha <strong style="color:#dc2626;">rechazado</strong> una de tus facturas. Es importante corregirla lo antes posible.</p>
        ${rejectBlock}
        ${detailsBlock}
        ${actionsBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Esta factura NO es válida fiscalmente en su estado actual.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 8. Texto plano
    const text =
        `Hola,\n\n` +
        `La DGII ha RECHAZADO la siguiente factura:\n\n` +
        `e-NCF: ${invoice.ncf}\n` +
        (invoice.type ? `Tipo: ${invoice.type}\n` : '') +
        (safeTotal ? `Total: ${safeTotal}\n` : '') +
        (safeIssuedAt ? `Emitida: ${safeIssuedAt}\n` : '') +
        `Empresa: ${company.name}\n` +
        (company.rnc ? `RNC: ${company.rnc}\n` : '') +
        (reason ? `\nMotivo del rechazo: ${reason}\n` : '') +
        `\n--- ¿QUÉ DEBES HACER? ---\n` +
        `• Revisa el detalle del rechazo en el sistema\n` +
        `• Corrige los datos señalados (RNC, montos, formato, etc.)\n` +
        `• Emite una nueva factura corregida\n` +
        `• Si no estás seguro del error, contacta a soporte\n\n` +
        `Esta factura NO es válida fiscalmente en su estado actual.\n\n` +
        `— El equipo de ${BRAND.name}`;

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