// ============================================================
// Template: plan-changed
//
// Caso de uso: subscriptions.changePlan (company_admin)
//   → el owner cambia de plan
//   → se genera un pago pendiente del nuevo plan
//   → se confirma el cambio + se avisa del pago
//
// API pública:
//   - buildSubject({ companyName, newPlanName }) → string
//   - render({ companyName, rnc, ownerName, oldPlanName, newPlanName,
//              amount, currency, periodStart, periodEnd, paymentDueAt }) → { html, text }
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
function buildSubject({ companyName, newPlanName } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const planLabel = newPlanName ? ` a ${newPlanName}` : '';
    return `🔄 Cambio de plan confirmado${planLabel} — ${safeCompany}`;
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
    oldPlanName,
    newPlanName,
    amount,
    currency = 'DOP',
    periodStart,
    periodEnd,
    paymentDueAt
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('planChanged: companyName is required');
    if (!newPlanName) throw new Error('planChanged: newPlanName is required');

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safeOldPlan = oldPlanName ? escapeHtml(oldPlanName) : null;
    const safeNewPlan = escapeHtml(newPlanName);
    const safeAmount = amount !== null && amount !== undefined
        ? formatAmount(amount, currency)
        : null;
    const safePeriodStart = formatDate(periodStart);
    const safePeriodEnd = formatDate(periodEnd);
    const safeDueDate = formatDate(paymentDueAt);

    // 3. Bloque de cambio de plan (antes → después)
    const changeBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
            ${safeOldPlan ? `
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
                Plan anterior
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${BRAND.mutedColor};text-decoration:line-through;margin-bottom:16px;">
                ${safeOldPlan}
            </div>` : ''}
            <div style="font-size:24px;color:${BRAND.primaryColor};margin:8px 0;">⬇️</div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.mutedColor};text-transform:uppercase;letter-spacing:1px;margin-top:8px;">
                Nuevo plan
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;color:${BRAND.primaryColor};font-weight:bold;margin-top:4px;">
                ${safeNewPlan}
            </div>
        </div>`;

    // 4. Bloque de datos del pago
    const paymentBlock = safeAmount ? `
        <div style="background:#fffbeb;border-left:4px solid #d97706;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#78350f;font-weight:bold;margin-bottom:8px;">
                💳 Pago pendiente del nuevo plan
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:8px;">
                ${safeAmount ? row('Monto', safeAmount) : ''}
                ${safePeriodStart && safePeriodEnd ? row('Período cubierto', `${safePeriodStart} al ${safePeriodEnd}`) : ''}
                ${safeDueDate ? row('Fecha límite', safeDueDate) : ''}
            </table>
        </div>` : '';

    // 5. Bloque de acciones
    const actionsBlock = safeAmount ? `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.7;">
                <strong>¿Qué sigue?</strong><br>
                • Tu nuevo plan está activo desde ahora<br>
                • Contacta a soporte para procesar el pago pendiente<br>
                • Una vez confirmado, recibirás un comprobante<br>
                • Si el pago no se procesa a tiempo, tu cuenta puede ser suspendida
            </div>
        </div>` : '';

    // 6. CTA
    const ctaBlock = safeAmount ? `
        <div style="text-align:center;margin:24px 0;">
            <a href="mailto:${escapeHtml(BRAND.supportEmail)}"
               style="display:inline-block;background:${BRAND.primaryColor};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                Contactar a soporte
            </a>
        </div>` : '';

    // 7. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Tu cambio de plan en <strong>${safeCompany}</strong> ha sido procesado correctamente.</p>
        ${changeBlock}
        ${paymentBlock}
        ${actionsBlock}
        ${ctaBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si no solicitaste este cambio, contacta a soporte inmediatamente.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 8. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Tu cambio de plan en ${companyName} ha sido procesado correctamente.\n\n` +
        `--- CAMBIO DE PLAN ---\n` +
        (rnc ? `Empresa: ${companyName} (RNC ${rnc})\n` : `Empresa: ${companyName}\n`) +
        (oldPlanName ? `Plan anterior: ${oldPlanName}\n` : '') +
        `Nuevo plan: ${newPlanName}\n` +
        (safeAmount ? `\n--- PAGO PENDIENTE ---\nMonto: ${safeAmount}\n` : '') +
        (safePeriodStart && safePeriodEnd ? `Período: ${safePeriodStart} al ${safePeriodEnd}\n` : '') +
        (safeDueDate ? `Fecha límite: ${safeDueDate}\n` : '') +
        (safeAmount ? `\nContacta a soporte para procesar el pago: ${BRAND.supportEmail}\n` : '') +
        `\nSi no solicitaste este cambio, contacta a soporte inmediatamente.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 9. Retorno
    const subject = buildSubject({ companyName, newPlanName });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };