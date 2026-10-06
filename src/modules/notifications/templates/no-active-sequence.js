// ============================================================
// Template: no-active-sequence
//
// Caso de uso: assignNextNCF (invoices.service)
//   → el usuario intenta crear una factura
//   → no hay secuencia NCF activa y vigente para ese tipo
//   → NO puede facturar → notificación urgente
//
// API pública:
//   - buildSubject({ type, typeName, companyName }) → string
//   - render({ companyName, rnc, ownerName, type, typeName, attemptedAt }) → { html, text }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

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
function buildSubject({ type, typeName, companyName } = {}) {
    const label = typeName ? `e-CF ${type} (${typeName})` : `e-CF ${type}`;
    const safeCompany = companyName || 'tu empresa';
    return `🔴 No puedes facturar: sin secuencia para ${label} — ${safeCompany}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({
    companyName,
    rnc,
    ownerName,
    type,
    typeName,
    attemptedAt
} = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('noActiveSequence: companyName is required');
    if (!type) throw new Error('noActiveSequence: type is required');

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');
    const safeType = escapeHtml(String(type));
    const safeTypeName = typeName ? escapeHtml(typeName) : null;
    const safeAttemptedAt = formatDateTime(attemptedAt || new Date());

    // 3. Bloque de datos del intento
    const detailsBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
                <tr>
                    <td style="color:${BRAND.mutedColor};width:150px;">Empresa:</td>
                    <td><strong>${safeCompany}</strong></td>
                </tr>
                ${safeRnc ? `
                <tr>
                    <td style="color:${BRAND.mutedColor};">RNC:</td>
                    <td><strong>${safeRnc}</strong></td>
                </tr>` : ''}
                <tr>
                    <td style="color:${BRAND.mutedColor};">Tipo de e-CF:</td>
                    <td><strong>${safeType}${safeTypeName ? ` — ${safeTypeName}` : ''}</strong></td>
                </tr>
                <tr>
                    <td style="color:${BRAND.mutedColor};">Fecha del intento:</td>
                    <td><strong>${escapeHtml(safeAttemptedAt)}</strong></td>
                </tr>
            </table>
        </div>`;

    // 4. Aviso crítico
    const alertBlock = `
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px 20px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#991b1b;font-weight:bold;margin-bottom:8px;">
                🔴 No pudimos emitir tu factura
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;line-height:1.5;">
                No hay ninguna <strong>secuencia NCF activa y vigente</strong> disponible para este tipo de e-CF.
                Sin una secuencia válida, NO puedes emitir facturas electrónicas de este tipo.
            </div>
        </div>`;

    // 5. Acciones sugeridas
    const actionsBlock = `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;margin:24px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1e40af;line-height:1.7;">
                <strong>¿Qué debes hacer?</strong><br>
                • Ingresa al sistema y registra una nueva secuencia NCF<br>
                • Si ya la tienes, verifica que esté <strong>activa</strong> y sin vencer<br>
                • Si se agotaron tus números, solicita una nueva secuencia a la DGII<br>
                • Si necesitas ayuda, contacta a soporte: <a href="mailto:${escapeHtml(BRAND.supportEmail)}" style="color:#1e40af;">${escapeHtml(BRAND.supportEmail)}</a>
            </div>
        </div>`;

    // 6. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Intentaste emitir una factura electrónica pero no pudimos completarla.</p>
        ${alertBlock}
        ${detailsBlock}
        ${actionsBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Este aviso se envía automáticamente cuando no se encuentra una secuencia válida al momento de facturar.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Texto plano
    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Intentaste emitir una factura electrónica pero no pudimos completarla.\n\n` +
        `🔴 NO HAY SECUENCIA NCF DISPONIBLE\n` +
        `Empresa: ${companyName}\n` +
        (rnc ? `RNC: ${rnc}\n` : '') +
        `Tipo de e-CF: ${type}${typeName ? ` — ${typeName}` : ''}\n` +
        `Fecha del intento: ${safeAttemptedAt}\n\n` +
        `No hay ninguna secuencia NCF activa y vigente disponible para este tipo de e-CF. ` +
        `Sin una secuencia válida, NO puedes emitir facturas electrónicas de este tipo.\n\n` +
        `--- ¿QUÉ DEBES HACER? ---\n` +
        `• Ingresa al sistema y registra una nueva secuencia NCF\n` +
        `• Si ya la tienes, verifica que esté activa y sin vencer\n` +
        `• Si se agotaron tus números, solicita una nueva secuencia a la DGII\n` +
        `• Si necesitas ayuda: ${BRAND.supportEmail}\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 8. Retorno
    const subject = buildSubject({ type, typeName, companyName });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };