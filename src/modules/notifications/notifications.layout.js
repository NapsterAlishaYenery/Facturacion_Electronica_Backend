// ============================================================
// Notifications layout — header + footer + wrapper común
//
// Este archivo es FIJO. Todos los correos comparten este layout.
// Solo el <body> cambia según el template (passwordReset, welcome…).
//
// Branding (nombre, logo, colores, RNC, etc.) vive en:
//   src/constants/brand.js
// ============================================================

const BRAND = require('../../constants/brand');

// ------------------------------------------------------------
// Utilidad interna: escapar HTML
// ------------------------------------------------------------
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ------------------------------------------------------------
// Header (fijo): logo + tagline + línea de acento azul→rojo
// ------------------------------------------------------------
function buildHeader() {
    // 1. Logo responsive (fondo transparente → se ve sobre blanco)
    const logo = `
        <img src="${BRAND.logoUrl}"
             alt="${escapeHtml(BRAND.name)}"
             width="140"
             style="display:block;width:140px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">`;

    // 2. Tagline
    const tagline = `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.mutedColor};letter-spacing:1px;text-transform:uppercase;margin-top:8px;">
            ${escapeHtml(BRAND.tagline)}
        </div>`;

    // 3. Barra de acento azul→rojo (toque futurista)
    const accentBar = `
        <div style="height:4px;background:linear-gradient(90deg,${BRAND.primaryColor} 0%,${BRAND.accentColor} 100%);"></div>`;

    // 4. Bloque completo
    return `
        <div style="background:${BRAND.cardColor};padding:28px 24px;text-align:center;">
            ${logo}
            ${tagline}
        </div>
        ${accentBar}`;
}

// ------------------------------------------------------------
// Footer (fijo): RNC + dirección + contacto + legal
// ------------------------------------------------------------
function buildFooter() {
    // 1. Datos legales (RNC, dirección, teléfono)
    const legalLines = [
        `<strong style="color:${BRAND.textColor};">${escapeHtml(BRAND.name)}</strong>`,
        `RNC: ${escapeHtml(BRAND.rnc)}`,
        escapeHtml(BRAND.address),
        BRAND.phone ? `Tel: ${escapeHtml(BRAND.phone)}` : null
    ].filter(Boolean).join('<br>');

    // 2. Contacto (email + web)
    const contactLine = `
        <a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:${BRAND.primaryColor};text-decoration:none;">${escapeHtml(BRAND.supportEmail)}</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(BRAND.website)}" style="color:${BRAND.primaryColor};text-decoration:none;">${escapeHtml(BRAND.website.replace(/^https?:\/\//, ''))}</a>`;

    // 3. Nota legal
    const legalNote = `
        <div style="margin-top:12px;font-size:11px;color:${BRAND.mutedColor};">
            Este es un correo automático. Por favor no responder directamente.
        </div>`;

    // 4. Bloque completo
    return `
        <div style="background:${BRAND.bgColor};padding:24px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.mutedColor};line-height:1.6;">
            ${legalLines}
            <div style="margin-top:10px;">${contactLine}</div>
            ${legalNote}
        </div>`;
}

// ------------------------------------------------------------
// wrapLayout — envuelve el body del template en el layout completo
// ------------------------------------------------------------
function wrapLayout({ title, bodyHtml }) {
    // 1. Header + Footer fijos
    const header = buildHeader();
    const footer = buildFooter();

    // 2. Documento completo (tabla responsive para email)
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title || BRAND.tagline)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bgColor};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bgColor};padding:24px 12px;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${BRAND.cardColor};border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td>${header}</td></tr>
<tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.textColor};">${bodyHtml}</td></tr>
<tr><td>${footer}</td></tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
    wrapLayout,
    escapeHtml,
    BRAND
};