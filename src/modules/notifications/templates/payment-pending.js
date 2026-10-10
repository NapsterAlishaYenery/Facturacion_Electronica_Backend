// ============================================================
// Template: payment-pending
//
// Caso de uso: job subscription-lifecycle (FASE 2)
//   → el job renueva automáticamente un período vencido
//   → crea un SubscriptionPayment con status='pending'
//   → avisa al dueño/empresa que debe pagar
//
// API pública:
//   - buildSubject({ companyName, planName }) → string
//   - render({ companyName, rnc, ownerName, planName, amount,
//              currency, periodStart, periodEnd, paymentDueAt }) → { html, text }
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
// Formatear monto con moneda
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
function buildSubject({ companyName, planName } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const planLabel = planName ? ` — ${planName}` : '';
    return `💳 Pago pendiente de tu suscripción${planLabel} — ${safeCompany}`;
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
    periodStart,
    periodEnd,
    paymentDueAt
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('paymentPending: companyName is required');
    if (amount === null || amount === undefined) {
        throw new Error('paymentPending: amount is required');
    }
    if (!periodEnd) throw new Error('paymentPending: periodEnd is required');

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safePlan = planName ? escapeHtml(planName) : null;
    const safeAmount = formatAmount(amount, currency);
    const safePeriodStart = formatDate(periodStart);
    const safePeriodEnd = formatDate(periodEnd);
    const safeDueDate = formatDate(paymentDueAt);

    // 3. Bloque de datos del pago
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
                ${safePlan ? row('Plan', safePlan) : ''}
                ${row('Monto', safeAmount)}
                ${safePeriodStart && safePeriodEnd ? row('Nuevo período', `${safePeriodStart} al ${safePeriodEnd}`) : ''}
                ${safeDueDate ? row('Fecha límite de pago', safeDueDate) : ''}
            </table>
        </div>`;

    // 4. Bloque de aviso
    const alertBlock = `
        <div style="background:#fffbeb;border-left:4px solid #d97706;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#78350f;font-weight:bold;margin-bottom:8px;">
                💳 Tu suscripción se renovó — pago pendiente
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78350f;line-height:1.5;">
                Se generó un nuevo período para tu plan. El pago correspondiente está pendiente de confirmación.
            </div>
        </div>`;

    // 5. Acciones
    const actionsBlock = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.7;">
                <strong>¿Qué debes hacer?</strong><br>
                • Contacta a soporte para procesar tu pago<br>
                • Tu servicio sigue activo mientras se confirma el pago<br>
                • Una vez confirmado, recibirás un correo de "pago recibido"<br>
                • Si el pago no se procesa a tiempo, tu cuenta puede ser suspendida
            </div>
        </div>`;

    // 6. CTA
    const ctaBlock = `
        <div style="text-align:center;margin:24px 0;">
            <a href="mailto:${escapeHtml(BRAND.supportEmail)}"
               style="display:inline-block;background:${BRAND.primaryColor};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                Contactar a soporte
            </a>
        </div>`;

    // 7. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Tu suscripción de <strong>${safeCompany}</strong> se ha renovado automáticamente para el próximo período.</p>
        ${alertBlock}
        ${detailsBlock}
        ${actionsBlock}
        ${ctaBlock}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 8. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Tu suscripción de ${companyName} se ha renovado automáticamente para el próximo período.\n\n` +
        `--- DETALLES ---\n` +
        (rnc ? `Empresa: ${companyName} (RNC ${rnc})\n` : `Empresa: ${companyName}\n`) +
        (planName ? `Plan: ${planName}\n` : '') +
        `Monto: ${safeAmount}\n` +
        (safePeriodStart && safePeriodEnd ? `Nuevo período: ${safePeriodStart} al ${safePeriodEnd}\n` : '') +
        (safeDueDate ? `Fecha límite de pago: ${safeDueDate}\n` : '') +
        `\n--- ¿QUÉ DEBES HACER? ---\n` +
        `• Contacta a soporte para procesar tu pago\n` +
        `• Tu servicio sigue activo mientras se confirma el pago\n` +
        `• Una vez confirmado, recibirás un correo de "pago recibido"\n` +
        `• Si el pago no se procesa a tiempo, tu cuenta puede ser suspendida\n\n` +
        `Soporte: ${BRAND.supportEmail}\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 9. Retorno
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