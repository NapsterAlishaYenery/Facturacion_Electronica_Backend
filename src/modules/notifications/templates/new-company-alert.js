// ============================================================
// Template: new-company-alert (correo interno a Expedinap)
//
// Caso de uso: POST /api/auth/register-company
//   → se registra una empresa nueva
//   → Expedinap recibe alerta con datos del registro
//
// Destinatario: buzón interno (REGISTRATION_NOTIFY_EMAIL)
//
// API pública:
//   - subject: string
//   - render({ company, owner, subscription, plan, meta }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Subject (con nombre de empresa para que destaque en la bandeja)
// ------------------------------------------------------------
function buildSubject({ company }) {
    const name = company?.name || 'sin nombre';
    return `🚀 Nueva empresa registrada: ${name}`;
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
function render({ company, owner, subscription, plan, meta }) {
    // 1. Validaciones mínimas
    if (!company) throw new Error('newCompanyAlert: company is required');
    if (!owner) throw new Error('newCompanyAlert: owner is required');

    // 2. Subject
    const subject = buildSubject({ company });

    // 3. Sección: Empresa
    const empresaSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            🏢 Empresa
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Nombre', company.name)}
            ${row('RNC', company.rnc)}
            ${row('Email', company.email)}
            ${row('Teléfono', company.phone)}
            ${row('Dirección', company.address)}
            ${row('Actividad', company.economicActivity)}
            ${row('Ambiente DGII', company.dgiiEnvironment)}
        </table>`;

    // 4. Sección: Dueño
    const fullName = [
        owner.firstName,
        owner.middleName,
        owner.lastName,
        owner.secondLastName
    ].filter(Boolean).join(' ');

    const ownerSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            👤 Dueño
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Nombre completo', fullName)}
            ${row('Email', owner.email)}
            ${row('Rol', owner.role)}
        </table>`;

    // 5. Sección: Suscripción
    const trialEndsStr = subscription?.trialEndsAt
        ? new Date(subscription.trialEndsAt).toLocaleDateString('es-DO', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : null;

    const subSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            💳 Suscripción
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Plan', plan?.name || subscription?.status)}
            ${row('Estado', subscription?.status)}
            ${row('Trial vence', trialEndsStr)}
        </table>`;

    // 6. Sección: Meta
    const metaSection = `
        <h3 style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.primaryColor};margin:20px 0 8px;border-bottom:2px solid ${BRAND.primaryColor};padding-bottom:4px;">
            🔍 Meta
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${row('Fecha de registro', new Date().toLocaleString('es-DO'))}
            ${row('IP', meta?.ip)}
            ${row('User-Agent', meta?.userAgent)}
        </table>`;

    // 7. Body
    const bodyHtml = `
        <p>Nueva empresa registrada en <strong>${escapeHtml(BRAND.name)} Facturación</strong>.</p>
        ${empresaSection}
        ${ownerSection}
        ${subSection}
        ${metaSection}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:12px;">
            Correo interno automático. No responder.
        </p>`;

    // 8. Texto plano
    const text =
        `NUEVA EMPRESA REGISTRADA\n\n` +
        `--- EMPRESA ---\n` +
        `Nombre: ${company.name}\n` +
        `RNC: ${company.rnc}\n` +
        (company.email ? `Email: ${company.email}\n` : '') +
        (company.phone ? `Teléfono: ${company.phone}\n` : '') +
        (company.address ? `Dirección: ${company.address}\n` : '') +
        (company.economicActivity ? `Actividad: ${company.economicActivity}\n` : '') +
        (company.dgiiEnvironment ? `Ambiente DGII: ${company.dgiiEnvironment}\n` : '') +
        `\n--- DUEÑO ---\n` +
        `Nombre: ${fullName}\n` +
        `Email: ${owner.email}\n` +
        `Rol: ${owner.role}\n` +
        `\n--- SUSCRIPCIÓN ---\n` +
        (plan?.name ? `Plan: ${plan.name}\n` : '') +
        (subscription?.status ? `Estado: ${subscription.status}\n` : '') +
        (trialEndsStr ? `Trial vence: ${trialEndsStr}\n` : '') +
        `\n--- META ---\n` +
        `Fecha: ${new Date().toLocaleString('es-DO')}\n` +
        (meta?.ip ? `IP: ${meta.ip}\n` : '') +
        (meta?.userAgent ? `User-Agent: ${meta.userAgent}\n` : '');

    // 9. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { subject: '🚀 Nueva empresa registrada', render, buildSubject };