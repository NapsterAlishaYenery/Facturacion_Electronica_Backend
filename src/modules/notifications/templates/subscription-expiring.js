// ============================================================
// Template: subscription-expiring
//
// Caso de uso: job subscription-lifecycle (fase preventiva)
//   → la suscripción de una empresa está por vencer (trial o plan)
//   → 1 correo por empresa al owner + company.email
//
// API pública:
//   - buildSubject({ companyName, status, planName, daysLeft }) → string
//   - render({ companyName, rnc, ownerName, status, planName, expiresAt, daysLeft }) → { html, text }
//
// status: 'trial' | 'active'
//   - trial:  "Tu período de prueba vence pronto"
//   - active: "Tu plan {planName} vence pronto"
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
function buildSubject({ companyName, status, planName, daysLeft } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const when = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;

    if (status === 'trial') {
        return `⏰ Tu período de prueba en ${safeCompany} vence ${when}`;
    }

    const planLabel = planName ? ` (${planName})` : '';
    return `⏰ Tu suscripción${planLabel} de ${safeCompany} vence ${when}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({
    companyName,
    rnc,
    ownerName,
    status,
    planName,
    expiresAt,
    daysLeft
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('subscriptionExpiring: companyName is required');
    if (!status) throw new Error('subscriptionExpiring: status is required');
    if (expiresAt === undefined || expiresAt === null) {
        throw new Error('subscriptionExpiring: expiresAt is required');
    }
    if (daysLeft === undefined || daysLeft === null) {
        throw new Error('subscriptionExpiring: daysLeft is required');
    }
    if (!['trial', 'active'].includes(status)) {
        throw new Error(`subscriptionExpiring: unknown status "${status}"`);
    }

    // 2. Configuración según status
    const isTrial = status === 'trial';
    const cfg = isTrial
        ? {
            color: '#d97706',
            bg: '#fffbeb',
            textColor: '#78350f',
            icon: '⏰',
            headline: 'Tu período de prueba está por terminar',
            intro: `Tu período de prueba gratuito de ${companyName} vence pronto.`,
            advice: 'Una vez termine, deberás contratar un plan para seguir emitiendo facturas electrónicas sin interrupciones.',
            cta: 'Contacta a nuestro equipo para elegir el plan que mejor se ajuste a tu negocio.'
        }
        : {
            color: '#2563eb',
            bg: '#eff6ff',
            textColor: '#1e40af',
            icon: '📅',
            headline: `Tu plan${planName ? ` ${planName}` : ''} está por vencer`,
            intro: `Tu suscripción de ${companyName} vence pronto.`,
            advice: 'Renueva a tiempo para no perder acceso a la emisión de facturas electrónicas ni a los demás servicios.',
            cta: 'Contacta a nuestro equipo para renovar tu plan.'
        };

    // 3. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safePlan = planName ? escapeHtml(planName) : null;
    const safeDate = escapeHtml(formatDate(expiresAt));
    const safeDays = Number(daysLeft);

    // 4. Bloque de datos
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
                <tr>
                    <td style="color:${BRAND.mutedColor};width:140px;">Empresa:</td>
                    <td><strong>${safeCompany}</strong></td>
                </tr>
                ${safeRnc ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">RNC:</td>
                    <td><strong>${safeRnc}</strong></td>
                </tr>` : ''}
                ${safePlan ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">Plan:</td>
                    <td><strong>${safePlan}</strong></td>
                </tr>` : ''}
                <tr>
                    <td style="color:${BRAND.mutedColor};">Vence el:</td>
                    <td><strong style="color:${cfg.color};">${safeDate}</strong></td>
                </tr>
                <tr>
                    <td style="color:${BRAND.mutedColor};">Días restantes:</td>
                    <td><strong>${safeDays} ${safeDays === 1 ? 'día' : 'días'}</strong></td>
                </tr>
            </table>
        </div>`;

    // 5. Bloque de aviso
    const alertBlock = `
        <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};padding:14px 18px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${cfg.textColor};font-weight:bold;margin-bottom:6px;">
                ${cfg.icon} ${escapeHtml(cfg.headline)}
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${cfg.textColor};line-height:1.5;">
                ${escapeHtml(cfg.advice)}
            </div>
        </div>`;

    // 6. Bloque CTA
    const ctaBlock = `
        <div style="text-align:center;margin:24px 0;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.textColor};margin-bottom:8px;">
                ${escapeHtml(cfg.cta)}
            </div>
            <a href="mailto:${escapeHtml(BRAND.supportEmail)}"
               style="display:inline-block;background:${BRAND.primaryColor};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                Contactar a soporte
            </a>
        </div>`;

    // 7. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>${escapeHtml(cfg.intro)}</p>
        ${alertBlock}
        ${detailsBlock}
        ${ctaBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si ya realizaste el pago o tienes alguna duda, escríbenos a ${escapeHtml(BRAND.supportEmail)}.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 8. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `${cfg.intro}\n\n` +
        `${cfg.icon} ${cfg.headline}\n` +
        `Empresa: ${companyName}\n` +
        (rnc ? `RNC: ${rnc}\n` : '') +
        (planName ? `Plan: ${planName}\n` : '') +
        `Vence el: ${formatDate(expiresAt)}\n` +
        `Días restantes: ${safeDays}\n\n` +
        `${cfg.advice}\n\n` +
        `${cfg.cta}\n` +
        `Soporte: ${BRAND.supportEmail}\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 9. Retorno
    const subject = buildSubject({ companyName, status, planName, daysLeft });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };