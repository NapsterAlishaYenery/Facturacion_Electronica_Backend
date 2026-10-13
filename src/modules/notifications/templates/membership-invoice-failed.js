// ============================================================
// Template: membership-invoice-failed
//
// Caso de uso: job membership-invoice-reconciliation
//   → un pago 'paid' no logró generar su factura de membresía
//     tras N intentos
//   → se alerta a Expedinap para intervención manual
//
// API pública:
//   - buildSubject({ payment, company, attempts }) → string
//   - render({ payment, company, attempts, lastError }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Formatear fecha/hora (es-DO)
// ------------------------------------------------------------
function formatDateTime(date) {
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
// Formatear monto
// ------------------------------------------------------------
function formatAmount(amount, currency = 'DOP') {
    if (amount === null || amount === undefined) return null;
    const num = Number(amount).toFixed(2);
    const symbol = currency === 'USD' ? 'US$' : 'RD$';
    return `${symbol} ${num}`;
}

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ payment, company, attempts } = {}) {
    const safeCompany = company?.name || 'empresa desconocida';
    return `🚨 Factura de membresía falló — ${safeCompany} (${attempts} intentos)`;
}

// ------------------------------------------------------------
// Helper: fila de tabla
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
function render({ payment, company, attempts, lastError } = {}) {
    // 1. Validaciones mínimas
    if (!payment) throw new Error('membershipInvoiceFailed: payment is required');
    if (!company) throw new Error('membershipInvoiceFailed: company is required');

    // 2. Datos escapados
    const safeCompany = escapeHtml(company.name || 'Empresa desconocida');
    const safeRnc = company.rnc ? escapeHtml(String(company.rnc)) : null;
    const safeAmount = formatAmount(payment.amount, payment.currency);
    const safePaidAt = formatDateTime(payment.paidAt);
    const safePeriodStart = formatDateTime(payment.periodStart);
    const safePeriodEnd = formatDateTime(payment.periodEnd);
    const safeLastAttempt = formatDateTime(payment.lastInvoiceAttemptAt);
    const safeError = lastError ? escapeHtml(String(lastError)) : null;
    const safeAttempts = escapeHtml(String(attempts ?? payment.invoiceGenerationAttempts ?? 0));

    // 3. Bloque de datos
    const detailsBlock = `
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
                ${row('Monto pagado', safeAmount)}
                ${safePaidAt ? row('Fecha de pago', safePaidAt) : ''}
                ${safePeriodStart && safePeriodEnd ? row('Período', `${safePeriodStart} al ${safePeriodEnd}`) : ''}
                ${row('Payment ID', payment.id)}
                ${row('Intentos fallidos', safeAttempts)}
                ${safeLastAttempt ? row('Último intento', safeLastAttempt) : ''}
                ${safeError ? row('Último error', safeError) : ''}
            </table>
        </div>`;

    // 4. Bloque de acción
    const actionBlock = `
        <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92400e;line-height:1.6;">
                <strong>Acción requerida:</strong> El pago fue registrado y cobrado, pero la factura de membresía no pudo generarse automáticamente. 
                El job de reconciliación ha dejado de intentar. Revisa manualmente el payment ID y regenera la factura desde el dashboard de admin.
            </div>
        </div>`;

    // 5. Body HTML
    const bodyHtml = `
        <p>Hola,</p>
        <p>Un pago de membresía quedó <strong>sin factura</strong> después de varios intentos automáticos.</p>
        ${detailsBlock}
        ${actionBlock}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — Sistema de ${escapeHtml(BRAND.name)}
        </p>`;

    // 6. Texto plano
    const text =
        `Alerta interna: factura de membresía no generada.\n\n` +
        `--- DATOS DEL PAGO ---\n` +
        `Empresa: ${company.name}${company.rnc ? ` (RNC ${company.rnc})` : ''}\n` +
        `Monto: ${safeAmount}\n` +
        `Payment ID: ${payment.id}\n` +
        (safePaidAt ? `Fecha de pago: ${safePaidAt}\n` : '') +
        (safePeriodStart && safePeriodEnd ? `Período: ${safePeriodStart} al ${safePeriodEnd}\n` : '') +
        `Intentos fallidos: ${safeAttempts}\n` +
        (safeLastAttempt ? `Último intento: ${safeLastAttempt}\n` : '') +
        (safeError ? `Último error: ${lastError}\n` : '') +
        `\n--- ACCIÓN REQUERIDA ---\n` +
        `El pago fue cobrado pero la factura no se generó. Regenera manualmente desde el dashboard.\n\n` +
        `— Sistema de ${BRAND.name}`;

    // 7. Retorno
    const subject = buildSubject({ payment, company, attempts });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };