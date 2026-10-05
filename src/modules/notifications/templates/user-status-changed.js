// ============================================================
// Template: user-status-changed
//
// Caso de uso: DELETE /api/auth/users/:id (o /company/users/:id)
//   → un admin o company_admin desactiva o elimina un usuario
//   → se envía confirmación al ejecutor (NO al afectado)
//
// API pública:
//   - buildSubject({ action, targetUser }) → string dinámico
//   - render({ action, targetUser, companyName, executor }) → { html, text }
//
// Datos requeridos: { action, targetUser }
// Datos opcionales: { companyName, executor }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Configuración por acción
// ------------------------------------------------------------
const ACTIONS = {
    deactivated: {
        verb: 'desactivado',
        color: '#d97706',          // ámbar
        icon: '⏸️',
        note: 'El usuario ya no podrá iniciar sesión. Puedes reactivarlo en cualquier momento si es necesario.'
    },
    deleted: {
        verb: 'eliminado',
        color: '#dc2626',          // rojo
        icon: '🗑️',
        note: 'Esta acción es permanente. El usuario y sus datos asociados han sido eliminados del sistema.'
    }
};

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ action, targetUser } = {}) {
    const cfg = ACTIONS[action];
    if (!cfg) throw new Error(`userStatusChanged: unknown action "${action}"`);

    const label = targetUser?.fullName || targetUser?.email || targetUser?.id || 'usuario';
    return `Usuario ${cfg.verb}: ${label}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ action, targetUser, companyName, executor } = {}) {
    // 1. Validaciones mínimas
    if (!action) throw new Error('userStatusChanged: action is required');
    if (!targetUser) throw new Error('userStatusChanged: targetUser is required');

    const cfg = ACTIONS[action];
    if (!cfg) throw new Error(`userStatusChanged: unknown action "${action}"`);

    // 2. Datos escapados
    const safeExecutor = escapeHtml(executor || 'usuario');
    const safeCompany = companyName ? escapeHtml(companyName) : null;
    const safeEmail = escapeHtml(targetUser.email || '');
    const safeName = escapeHtml(targetUser.fullName || targetUser.email || 'usuario');
    const safeRole = escapeHtml(targetUser.role || '');
    const safeId = escapeHtml(String(targetUser.id || ''));

    // 3. Bloque de datos del usuario afectado
    const targetBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
                <tr>
                    <td style="color:${BRAND.mutedColor};width:120px;">Nombre:</td>
                    <td><strong>${safeName}</strong></td>
                </tr>
                ${safeEmail ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">Email:</td>
                    <td><strong>${safeEmail}</strong></td>
                </tr>` : ''}
                ${safeRole ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">Rol:</td>
                    <td><strong>${safeRole}</strong></td>
                </tr>` : ''}
                ${safeCompany ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">Empresa:</td>
                    <td><strong>${safeCompany}</strong></td>
                </tr>` : ''}
                ${safeId ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">ID:</td>
                    <td style="font-family:'Courier New',monospace;font-size:12px;">${safeId}</td>
                </tr>` : ''}
            </table>
        </div>`;

    // 4. Aviso contextual según acción
    const noticeBlock = `
        <div style="background:#fef3c7;border-left:4px solid ${cfg.color};padding:12px 16px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#78350f;line-height:1.5;">
                <strong>${cfg.icon} ${cfg.note}</strong>
            </div>
        </div>`;

    // 5. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeExecutor}</strong>,</p>
        <p>Un usuario ha sido <strong style="color:${cfg.color};">${cfg.verb}</strong>${safeCompany ? ` en <strong>${safeCompany}</strong>` : ''}.</p>
        ${targetBlock}
        ${noticeBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Este es un correo de confirmación automático. No requiere ninguna acción.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 6. Texto plano
    const text =
        `Hola ${executor || 'usuario'},\n\n` +
        `Un usuario ha sido ${cfg.verb}${companyName ? ` en ${companyName}` : ''}.\n\n` +
        `Nombre: ${targetUser.fullName || targetUser.email || 'usuario'}\n` +
        (targetUser.email ? `Email: ${targetUser.email}\n` : '') +
        (targetUser.role ? `Rol: ${targetUser.role}\n` : '') +
        (targetUser.id ? `ID: ${targetUser.id}\n` : '') +
        `\n${cfg.note}\n\n` +
        `Este es un correo de confirmación automático. No requiere ninguna acción.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 7. Retorno
    const subject = buildSubject({ action, targetUser });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };