// ============================================================
// Template: password reset (código de 6 dígitos)
//
// Caso de uso: POST /api/auth/forgot-password
//   → usuario NO logueado solicita recuperar contraseña
//   → recibe un código numérico de 6 dígitos por email
//   → lo pega en el frontend para cambiar la contraseña
//
// API pública:
//   - subject: string (constante del template)
//   - render({ name, code, expiresInMinutes }) → { html, text }
//
// Datos requeridos: { code }
// Datos opcionales: { name, expiresInMinutes = 15 }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Subject (constante del template — el service lo aplica al enviar)
// ------------------------------------------------------------
const subject = 'Código de recuperación de contraseña';

// ------------------------------------------------------------
// Render — devuelve { html, text } listos para enviar
// ------------------------------------------------------------
function render({ name, code, expiresInMinutes = 15 }) {
    // 1. Validaciones mínimas
    if (!code) throw new Error('passwordResetCode: code is required');

    // 2. Datos escapados
    const safeName = escapeHtml(name || 'usuario');
    const safeCode = escapeHtml(String(code));
    const safeMinutes = Number(expiresInMinutes);

    // 3. Bloque del código (protagonista, fácil de leer)
    const codeBlock = `
        <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:${BRAND.bgColor};border:2px dashed ${BRAND.primaryColor};border-radius:10px;padding:18px 30px;">
                <div style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:7px;color:${BRAND.primaryColor};">
                    ${safeCode}
                </div>
            </div>
        </div>`;

    // 4. Aviso de seguridad (nunca compartir)
    const securityNote = `
        <div style="background:#fef2f2;border-left:4px solid ${BRAND.accentColor};padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                <strong>⚠️ Nunca compartas este código con nadie.</strong><br>
                El equipo de ${escapeHtml(BRAND.name)} jamás te pedirá este código por teléfono, chat o email.
            </div>
        </div>`;

    // 5. Aviso "si no fuiste tú"
    const ignoreNote = `
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña seguirá siendo la misma.
        </p>`;

    // 6. Firma
    const signature = `
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Body HTML completo
    const bodyHtml = `
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código para continuar:</p>
        ${codeBlock}
        <p style="text-align:center;color:${BRAND.mutedColor};font-size:13px;margin:0;">
            Este código expira en <strong>${safeMinutes} minutos</strong>.
        </p>
        ${securityNote}
        ${ignoreNote}
        ${signature}`;

    // 8. Texto plano (fallback)
    const text =
        `Hola ${name || 'usuario'},\n\n` +
        `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
        `Tu código de recuperación es:\n\n` +
        `    ${code}\n\n` +
        `Este código expira en ${safeMinutes} minutos.\n\n` +
        `⚠️ NUNCA compartas este código con nadie. El equipo de ${BRAND.name} jamás te lo pedirá.\n\n` +
        `Si no solicitaste este cambio, ignora este correo. Tu contraseña seguirá siendo la misma.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 9. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { subject, render };