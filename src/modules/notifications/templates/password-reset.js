// ============================================================
// Template: password reset (confirmación post-cambio)
//
// Caso de uso: POST /api/auth/reset-password
//   → usuario ingresó el código de 6 dígitos
//   → el sistema cambió la contraseña
//   → este correo confirma el cambio (alerta de seguridad)
//
// API pública:
//   - subject: string (constante)
//   - render({ name, when, ip }) → { html, text }
//
// Datos requeridos: ninguno (todos opcionales)
//   - name: si falta, usa "usuario"
//   - when: si falta, usa new Date()
//   - ip:   si falta, la fila IP se omite
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Subject
// ------------------------------------------------------------
const subject = 'Tu contraseña fue restablecida';

// ------------------------------------------------------------
// Formatear fecha legible (RD)
// ------------------------------------------------------------
function formatDate(date) {
    return new Date(date).toLocaleString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ name, when, ip } = {}) {
    // 1. Datos escapados
    const safeName = escapeHtml(name || 'usuario');
    const safeWhen = escapeHtml(formatDate(when || new Date()));
    const safeIp = ip ? escapeHtml(String(ip)) : null;

    // 2. Bloque de detalles del cambio
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
                <tr>
                    <td style="color:${BRAND.mutedColor};width:120px;">Fecha:</td>
                    <td><strong>${safeWhen}</strong></td>
                </tr>
                ${safeIp ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">IP:</td>
                    <td><strong>${safeIp}</strong></td>
                </tr>` : ''}
            </table>
        </div>`;

    // 3. Aviso de seguridad (importante si no fuiste tú)
    const securityNote = `
        <div style="background:#fef2f2;border-left:4px solid ${BRAND.accentColor};padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                <strong>¿No reconoces este cambio?</strong><br>
                Contacta a soporte inmediatamente. Tu cuenta puede estar comprometida.
            </div>
        </div>`;

    // 4. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Tu contraseña ha sido <strong>restablecida correctamente</strong>.</p>
        ${detailsBlock}
        <p>Si fuiste tú, no necesitas hacer nada. Ya puedes iniciar sesión con tu nueva contraseña.</p>
        ${securityNote}
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 5. Texto plano
    const text =
        `Hola ${name || 'usuario'},\n\n` +
        `Tu contraseña ha sido restablecida correctamente.\n\n` +
        `Fecha: ${safeWhen}\n` +
        (safeIp ? `IP: ${safeIp}\n` : '') +
        `\nSi fuiste tú, no necesitas hacer nada.\n\n` +
        `⚠️ Si NO reconoces este cambio, contacta a soporte inmediatamente.\n` +
        `Tu cuenta puede estar comprometida.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 6. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { subject, render };