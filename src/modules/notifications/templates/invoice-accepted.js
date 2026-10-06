// ============================================================
// Template: invoice-accepted
//
// Caso de uso: job poll-pending-status
//   → DGII acepta una factura enviada
//   → notificación al owner + company + bcc Expedinap
//
// API pública:
//   - buildSubject({ invoice, company }) → string
//   - render({ invoice, company }) → { html, text }
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
    return `✅ Factura ${ncf} aceptada por DGII — ${companyName}`;
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
function render({ invoice, company } = {}) {
    // 1. Validaciones mínimas
    if (!invoice) throw new Error('invoiceAccepted: invoice is required');
    if (!company) throw new Error('invoiceAccepted: company is required');

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

    // 4. Bloque de datos de la factura
    const detailsBlock = `
        <div style="background:#ecfdf5;border-left:4px solid #059669;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('e-NCF', safeNcf)}
                ${row('Tipo', safeType)}
                ${safeTotal ? row('Total', safeTotal) : ''}
                ${safeIssuedAt ? row('Emitida', safeIssuedAt) : ''}
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
            </table>
        </div>`;

    // 5. Bloque de éxito
    const successBlock = `
        <div style="text-align:center;margin:24px 0;">
            <div style="font-size:48px;line-height:1;">✅</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#065f46;font-weight:bold;margin-top:8px;">
                Tu factura fue aceptada por la DGII
            </div>
        </div>`;

    // 6. Body HTML
    const bodyHtml = `
        <p>Hola,</p>
        <p>Buenas noticias: la siguiente factura fue <strong style="color:#059669;">aceptada</strong> por la DGII.</p>
        ${successBlock}
        ${detailsBlock}
        <p>Ya puedes entregarla a tu cliente con confianza. Está registrada y validada fiscalmente.</p>
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Este es un correo automático de confirmación. No requiere ninguna acción.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Texto plano
    const text =
        `Hola,\n\n` +
        `La siguiente factura fue ACEPTADA por la DGII:\n\n` +
        `e-NCF: ${invoice.ncf}\n` +
        (invoice.type ? `Tipo: ${invoice.type}\n` : '') +
        (safeTotal ? `Total: ${safeTotal}\n` : '') +
        (safeIssuedAt ? `Emitida: ${safeIssuedAt}\n` : '') +
        `Empresa: ${company.name}\n` +
        (company.rnc ? `RNC: ${company.rnc}\n` : '') +
        `\nYa puedes entregarla a tu cliente con confianza.\n\n` +
        `Este es un correo automático de confirmación.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 8. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };