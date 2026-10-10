// ============================================================
// Template: payment-pending-alert (correo interno a Expedinap)
//
// Caso de uso: job subscription-lifecycle (FASE 2)
//   → el mismo evento que paymentPending, pero para Expedinap
//   → resumen ejecutivo de cada pago pendiente generado
//
// Destinatario: buzón interno (REGISTRATION_NOTIFY_EMAIL)
//
// API pública:
//   - buildSubject({ companyName, planName, amount }) → string
//   - render({ company, owner, plan, amount, currency,
//              periodStart, periodEnd, paymentDueAt }) → { html, text }
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
function buildSubject({ companyName, planName, amount, currency = 'DOP' } = {}) {
    const safeCompany = companyName || 'empresa';
    const safePlan = planName ? ` (${planName})` : '';
    const safeAmount = formatAmount(amount, currency) || '';
    return `💳 Pago pendiente: ${safeCompany}${safePlan} — ${safeAmount}`;
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
function render({
    company,
    owner,
    plan,
    amount,
    currency = 'DOP',
    periodStart,
    periodEnd,
    paymentDueAt
} = {}) {
    // 1. Validaciones mínimas
    if (!company) throw new Error('paymentPendingAlert: company is required');
    if (amount === null || amount === undefined) {
        throw new Error('paymentPendingAlert: amount is required');
    }

    // 2. Subject
    const subject = buildSubject({
        companyName: company.name,
        planName: plan?.name,
        amount,
        currency
    });

    // 3. Secciones
    const empresaSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            🏢 Empresa
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Nombre', company.name)}
            ${row('RNC', company.rnc)}
            ${row('Email', company.email)}
        </table>`;

    const ownerSection = owner ? `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            👤 Dueño
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Nombre', owner.firstName)}
            ${row('Email', owner.email)}
        </table>` : '';

    const pagoSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            💳 Pago pendiente
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Plan', plan?.name)}
            ${row('Monto', formatAmount(amount, currency))}
            ${row('Período', formatDate(periodStart) && formatDate(periodEnd)
                ? `${formatDate(periodStart)} al ${formatDate(periodEnd)}`
                : null)}
            ${row('Fecha límite', formatDate(paymentDueAt))}
        </table>`;

    // 4. Nota de acción
    const actionNote = `
        <div style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78350f;line-height:1.5;">
                <strong>Acción sugerida:</strong> contactar al cliente para coordinar el pago antes de la fecha límite. Si no se procesa, evaluar suspensión de la cuenta.
            </div>
        </div>`;

    // 5. Body HTML
    const bodyHtml = `
        <p>Se ha generado un nuevo <strong>pago pendiente</strong> por renovación automática.</p>
        ${empresaSection}
        ${ownerSection}
        ${pagoSection}
        ${actionNote}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:12px;">
            Correo interno automático. No responder.
        </p>`;

    // 6. Texto plano
    const text =
        `NUEVO PAGO PENDIENTE\n\n` +
        `--- EMPRESA ---\n` +
        `Nombre: ${company.name}\n` +
        (company.rnc ? `RNC: ${company.rnc}\n` : '') +
        (company.email ? `Email: ${company.email}\n` : '') +
        (owner ? `\n--- DUEÑO ---\nNombre: ${owner.firstName}\nEmail: ${owner.email}\n` : '') +
        `\n--- PAGO ---\n` +
        (plan?.name ? `Plan: ${plan.name}\n` : '') +
        `Monto: ${formatAmount(amount, currency)}\n` +
        (formatDate(periodStart) && formatDate(periodEnd)
            ? `Período: ${formatDate(periodStart)} al ${formatDate(periodEnd)}\n`
            : '') +
        (formatDate(paymentDueAt) ? `Fecha límite: ${formatDate(paymentDueAt)}\n` : '') +
        `\nAcción sugerida: contactar al cliente para coordinar el pago.\n\n` +
        `Correo interno automático.`;

    // 7. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };