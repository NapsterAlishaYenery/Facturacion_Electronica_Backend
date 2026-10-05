// ============================================================
// Template: certificate-expiring
//
// Caso de uso: job alert-expiring-certs
//   → detecta certificados .p12 que vencen en los próximos N días
//   → avisa al dueño y a la empresa
//
// Cubre 2 casos con un flag:
//   - expired: false → "vence en X días"
//   - expired: true  → "ya venció hace X días"
//
// API pública:
//   - buildSubject({ companyName, daysLeft, expired }) → string
//   - render({ companyName, rnc, ownerName, expiresAt, daysLeft, expired }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Formatear fecha larga (es-DO)
// ------------------------------------------------------------
function formatDate(date) {
    return new Date(date).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ companyName, daysLeft, expired } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const absDays = Math.abs(daysLeft);

    if (expired) {
        const when = absDays === 0
            ? 'hoy'
            : `hace ${absDays} ${absDays === 1 ? 'día' : 'días'}`;
        return `🔴 Certificado digital de ${safeCompany} VENCIDO ${when}`;
    }

    const when = daysLeft === 0
        ? 'vence HOY'
        : `vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;

    return `⚠️ Certificado digital de ${safeCompany} ${when}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({
    companyName,
    rnc,
    ownerName,
    expiresAt,
    daysLeft,
    expired
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('certificateExpiring: companyName is required');
    if (expiresAt === undefined || expiresAt === null) {
        throw new Error('certificateExpiring: expiresAt is required');
    }
    if (daysLeft === undefined || daysLeft === null) {
        throw new Error('certificateExpiring: daysLeft is required');
    }

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safeDate = escapeHtml(formatDate(expiresAt));
    const absDays = Math.abs(Number(daysLeft));
    const isExpired = Boolean(expired);

    // 3. Configuración por estado
    const cfg = isExpired
        ? {
            color: '#dc2626',
            bg: '#fef2f2',
            textColor: '#991b1b',
            icon: '🔴',
            headline: absDays === 0
                ? 'Tu certificado digital venció HOY'
                : `Tu certificado digital venció hace ${absDays} ${absDays === 1 ? 'día' : 'días'}`,
            advice: '🚨 Sin un certificado válido NO puedes emitir facturas electrónicas ni enviarlas a la DGII. Renueva tu certificado lo antes posible.'
        }
        : {
            color: '#d97706',
            bg: '#fffbeb',
            textColor: '#78350f',
            icon: '⚠️',
            headline: absDays === 0
                ? 'Tu certificado digital vence HOY'
                : `Tu certificado digital vence en ${absDays} ${absDays === 1 ? 'día' : 'días'}`,
            advice: '🔔 Renuévalo antes de la fecha indicada para evitar interrupciones en tu facturación electrónica.'
        };

    // 4. Bloque de datos de la empresa
    const companyBlock = `
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
                <tr>
                    <td style="color:${BRAND.mutedColor};">Fecha de vencimiento:</td>
                    <td><strong style="color:${cfg.color};">${safeDate}</strong></td>
                </tr>
                <tr>
                    <td style="color:${BRAND.mutedColor};">Estado:</td>
                    <td><strong style="color:${cfg.color};">${isExpired ? 'VENCIDO' : 'Por vencer'}</strong></td>
                </tr>
            </table>
        </div>`;

    // 5. Bloque de aviso grande
    const alertBlock = `
        <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};padding:16px 20px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${cfg.textColor};font-weight:bold;margin-bottom:8px;">
                ${cfg.icon} ${escapeHtml(cfg.headline)}
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${cfg.textColor};line-height:1.5;">
                ${escapeHtml(cfg.advice)}
            </div>
        </div>`;

    // 6. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Este es un aviso automático sobre el certificado digital de <strong>${safeCompany}</strong>.</p>
        ${alertBlock}
        ${companyBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si ya renovaste tu certificado, por favor actualízalo en el sistema para detener estos avisos.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Aviso sobre el certificado digital de ${companyName}` +
        (rnc ? ` (RNC ${rnc})` : '') + '.\n\n' +
        `${cfg.icon} ${cfg.headline}\n` +
        `Fecha de vencimiento: ${formatDate(expiresAt)}\n` +
        `Estado: ${isExpired ? 'VENCIDO' : 'Por vencer'}\n\n` +
        `${cfg.advice}\n\n` +
        `Si ya renovaste tu certificado, actualízalo en el sistema para detener estos avisos.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 8. Retorno
    const subject = buildSubject({ companyName, daysLeft, expired: isExpired });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };