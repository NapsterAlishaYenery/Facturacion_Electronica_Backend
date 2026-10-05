// ============================================================
// Template: new user
//
// Caso de uso: POST /api/auth/users (admin o company_admin)
//   → se crea un usuario con contraseña temporal
//   → recibe credenciales por email para entrar
//
// API pública:
//   - subject: string (fijo cuando no hay empresa)
//   - buildSubject({ companyName }): string dinámico
//   - render({ name, email, password, companyName, loginUrl }) → { html, text }
//
// Datos requeridos: { email, password }
// Datos opcionales: { name, companyName, loginUrl }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Subject estático (fallback si no hay empresa)
// ------------------------------------------------------------
const subject = `Bienvenido a ${BRAND.name}`;

// ------------------------------------------------------------
// Subject dinámico (incluye empresa cuando aplica)
// ------------------------------------------------------------
function buildSubject({ companyName } = {}) {
    if (companyName) return `Bienvenido a ${companyName}`;
    return `Bienvenido al equipo de ${BRAND.name}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ name, email, password, companyName, loginUrl } = {}) {
    // 1. Validaciones mínimas
    if (!email) throw new Error('newUser: email is required');
    if (!password) throw new Error('newUser: password is required');

    // 2. Datos escapados
    const safeName = escapeHtml(name || 'usuario');
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(String(password));
    const safeCompany = companyName ? escapeHtml(companyName) : null;
    const safeLoginUrl = loginUrl ? escapeHtml(loginUrl) : null;

    // 3. Intro según contexto
    const intro = safeCompany
        ? `Se ha creado una cuenta para ti en <strong>${safeCompany}</strong>.`
        : `Se ha creado una cuenta para ti en <strong>${escapeHtml(BRAND.name)}</strong>.`;

    // 4. Bloque de credenciales
    const credentialsBlock = `
        <div style="background:${BRAND.bgColor};border:2px dashed ${BRAND.primaryColor};border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.mutedColor};letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">
                Tus credenciales
            </div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:15px;color:${BRAND.textColor};margin:6px 0;">
                <strong>Email:</strong> ${safeEmail}
            </div>
            <div style="font-family:'Courier New',Courier,monospace;font-size:18px;color:${BRAND.primaryColor};margin:6px 0;">
                <strong>Contraseña:</strong> ${safePassword}
            </div>
        </div>`;

    // 5. Botón de login (opcional)
    const buttonBlock = safeLoginUrl ? `
        <div style="text-align:center;margin:24px 0;">
            <a href="${safeLoginUrl}"
               style="display:inline-block;background:${BRAND.primaryColor};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                Iniciar sesión
            </a>
        </div>` : '';

    // 6. Aviso de seguridad (cambio de contraseña)
    const securityNote = `
        <div style="background:#fef2f2;border-left:4px solid ${BRAND.accentColor};padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                <strong>⚠️ Por seguridad, cambia tu contraseña la primera vez que entres.</strong><br>
                Esta es una contraseña temporal. Nunca la compartas con nadie.
            </div>
        </div>`;

    // 7. Aviso "si no esperabas esta cuenta"
    const ignoreNote = `
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si no esperabas recibir esta cuenta, por favor contacta a soporte.
        </p>`;

    // 8. Firma
    const signature = `
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 9. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>${intro}</p>
        <p>Usa estas credenciales para acceder:</p>
        ${credentialsBlock}
        ${buttonBlock}
        ${securityNote}
        ${ignoreNote}
        ${signature}`;

    // 10. Texto plano
    const text =
        `Hola ${name || 'usuario'},\n\n` +
        (safeCompany
            ? `Se ha creado una cuenta para ti en ${companyName}.\n\n`
            : `Se ha creado una cuenta para ti en ${BRAND.name}.\n\n`) +
        `Tus credenciales:\n` +
        `    Email: ${email}\n` +
        `    Contraseña: ${password}\n\n` +
        (loginUrl ? `Inicia sesión aquí: ${loginUrl}\n\n` : '') +
        `⚠️ Por seguridad, cambia tu contraseña la primera vez que entres.\n` +
        `Esta es una contraseña temporal. Nunca la compartas con nadie.\n\n` +
        `Si no esperabas recibir esta cuenta, contacta a soporte.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 11. Retorno
    return {
        html: wrapLayout({ title: buildSubject({ companyName }), bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { subject, buildSubject, render };