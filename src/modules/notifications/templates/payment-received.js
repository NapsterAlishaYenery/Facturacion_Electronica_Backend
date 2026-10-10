// ============================================================
// Template: payment-received
//
// Caso de uso: subscriptions.registerPayment (admin)
//   → admin registra un pago con status='paid'
//   → la suscripción se reactiva
//   → se envía comprobante al owner + company.email
//
// API pública:
//   - buildSubject({ companyName, planName }) → string
//   - render({ companyName, rnc, ownerName, planName, amount,
//              currency, paymentMethod, reference, periodStart,
//              periodEnd, paidAt }) → { html, text }
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
// Etiqueta legible del método de pago
// ------------------------------------------------------------
const METHOD_LABELS = {
    cash: 'Efectivo',
    transfer: 'Transferencia bancaria',
    card: 'Tarjeta',
    check: 'Cheque',
    other: 'Otro'
};

function formatPaymentMethod(method) {
    if (!method) return null;
    return METHOD_LABELS[method] || method;
}

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ companyName, planName } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const planLabel = planName ? ` — ${planName}` : '';
    return `✅ Pago recibido${planLabel} — ${safeCompany}`;
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
function render({
    companyName,
    rnc,
    ownerName,
    planName,
    amount,
    currency = 'DOP',
    paymentMethod,
    reference,
    periodStart,
    periodEnd,
    paidAt
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('paymentReceived: companyName is required');
    if (amount === null || amount === undefined) {
        throw new Error('paymentReceived: amount is required');
    }

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safePlan = planName ? escapeHtml(planName) : null;
    const safeAmount = formatAmount(amount, currency);
    const safeMethod = formatPaymentMethod(paymentMethod);
    const safeReference = reference ? escapeHtml(String(reference)) : null;
    const safePeriodStart = formatDate(periodStart);
    const safePeriodEnd = formatDate(periodEnd);
    const safePaidAt = formatDateTime(paidAt);

    // 3. Bloque de datos del pago
    const detailsBlock = `
        <div style="background:#ecfdf5;border-left:4px solid #059669;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
                ${safePlan ? row('Plan', safePlan) : ''}
                ${row('Monto', safeAmount)}
                ${safeMethod ? row('Método', safeMethod) : ''}
                ${safeReference ? row('Referencia', safeReference) : ''}
                ${safePeriodStart && safePeriodEnd ? row('Período cubierto', `${safePeriodStart} al ${safePeriodEnd}`) : ''}
                ${safePaidAt ? row('Fecha de pago', safePaidAt) : ''}
            </table>
        </div>`;

    // 4. Bloque de éxito
    const successBlock = `
        <div style="text-align:center;margin:24px 0;">
            <div style="font-size:48px;line-height:1;">✅</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#065f46;font-weight:bold;margin-top:8px;">
                Pago recibido correctamente
            </div>
        </div>`;

    // 5. Nota sobre la cuenta
    const accountNote = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.6;">
                <strong>Tu cuenta está activa.</strong> Ya puedes seguir emitiendo facturas electrónicas sin interrupciones. 
                Gracias por confiar en ${escapeHtml(BRAND.name)}.
            </div>
        </div>`;

    // 6. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Hemos recibido tu pago para <strong>${safeCompany}</strong>. ¡Gracias!</p>
        ${successBlock}
        ${detailsBlock}
        ${accountNote}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Este correo es tu comprobante. Consérvalo para tus registros.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Hemos recibido tu pago para ${companyName}. ¡Gracias!\n\n` +
        `--- DETALLES DEL PAGO ---\n` +
        (rnc ? `Empresa: ${companyName} (RNC ${rnc})\n` : `Empresa: ${companyName}\n`) +
        (planName ? `Plan: ${planName}\n` : '') +
        `Monto: ${safeAmount}\n` +
        (safeMethod ? `Método: ${safeMethod}\n` : '') +
        (safeReference ? `Referencia: ${reference}\n` : '') +
        (safePeriodStart && safePeriodEnd ? `Período: ${safePeriodStart} al ${safePeriodEnd}\n` : '') +
        (safePaidAt ? `Fecha de pago: ${safePaidAt}\n` : '') +
        `\nTu cuenta está activa. Ya puedes seguir emitiendo facturas electrónicas.\n\n` +
        `Este correo es tu comprobante. Consérvalo para tus registros.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 8. Retorno
    const subject = buildSubject({ companyName, planName });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };