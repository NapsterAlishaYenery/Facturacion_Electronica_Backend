// ============================================================
// Template: subscription-cancelled
//
// Caso de uso: subscriptions.cancelMySubscription (company_admin)
//   → el owner cancela su suscripción
//   → se confirma por correo (seguridad + info)
//   → aviso de cuándo termina el acceso
//
// API pública:
//   - buildSubject({ companyName }) → string
//   - render({ companyName, rnc, ownerName, planName,
//              cancelledAt, accessUntil, daysLeft }) → { html, text }
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
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ companyName } = {}) {
    const safeCompany = companyName || 'tu empresa';
    return `🚫 Suscripción cancelada — ${safeCompany}`;
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
    cancelledAt,
    accessUntil,
    daysLeft
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('subscriptionCancelled: companyName is required');
    if (!cancelledAt) throw new Error('subscriptionCancelled: cancelledAt is required');

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safePlan = planName ? escapeHtml(planName) : null;
    const safeCancelledAt = escapeHtml(formatDateTime(cancelledAt));
    const safeAccessUntil = formatDate(accessUntil);
    const safeDays = Number(daysLeft) || 0;
    const hasRemainingAccess = safeAccessUntil && safeDays > 0;

    // 3. Bloque de datos
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${row('Empresa', safeCompany)}
                ${safeRnc ? row('RNC', safeRnc) : ''}
                ${safePlan ? row('Plan', safePlan) : ''}
                ${row('Fecha de cancelación', safeCancelledAt)}
                ${safeAccessUntil ? row('Acceso hasta', safeAccessUntil) : ''}
                ${hasRemainingAccess ? row('Días restantes', `${safeDays} ${safeDays === 1 ? 'día' : 'días'}`) : ''}
            </table>
        </div>`;

    // 4. Aviso principal
    const alertBlock = `
        <div style="background:#fef3c7;border-left:4px solid #d97706;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#78350f;font-weight:bold;margin-bottom:8px;">
                🚫 Tu suscripción ha sido cancelada
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78350f;line-height:1.5;">
                ${hasRemainingAccess
                    ? `Puedes seguir usando el sistema hasta el <strong>${safeAccessUntil}</strong>. Después de esa fecha, perderás acceso a la emisión de facturas electrónicas y a los demás servicios.`
                    : `El acceso al sistema ha sido cerrado. Si crees que es un error, contacta a soporte.`}
            </div>
        </div>`;

    // 5. Bloque de reactivación
    const reactivateBlock = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.6;">
                <strong>¿Cambiaste de opinión?</strong><br>
                Puedes reactivar tu suscripción en cualquier momento contactando a soporte. Conservaremos tus datos durante un tiempo por si decides volver.
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
        <p>Hemos recibido tu solicitud de cancelación. Confirmamos que la suscripción de <strong>${safeCompany}</strong> ha sido cancelada.</p>
        ${alertBlock}
        ${detailsBlock}
        ${reactivateBlock}
        ${ctaBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si NO solicitaste esta cancelación, contacta a soporte inmediatamente.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 8. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Hemos recibido tu solicitud de cancelación. Confirmamos que la suscripción de ${companyName} ha sido cancelada.\n\n` +
        `--- DETALLES ---\n` +
        (rnc ? `Empresa: ${companyName} (RNC ${rnc})\n` : `Empresa: ${companyName}\n`) +
        (planName ? `Plan: ${planName}\n` : '') +
        `Fecha de cancelación: ${safeCancelledAt}\n` +
        (safeAccessUntil ? `Acceso hasta: ${safeAccessUntil}\n` : '') +
        (hasRemainingAccess ? `Días restantes: ${safeDays}\n` : '') +
        `\n` +
        (hasRemainingAccess
            ? `Puedes seguir usando el sistema hasta el ${safeAccessUntil}. Después de esa fecha perderás acceso a la emisión de facturas electrónicas.\n\n`
            : `El acceso al sistema ha sido cerrado.\n\n`) +
        `¿Cambiaste de opinión? Contacta a soporte para reactivar tu suscripción.\n` +
        `Soporte: ${BRAND.supportEmail}\n\n` +
        `Si NO solicitaste esta cancelación, contacta a soporte inmediatamente.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 9. Retorno
    const subject = buildSubject({ companyName });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };