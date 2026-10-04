// ============================================================
// Template: welcome
//
// Caso de uso: POST /api/auth/register-company
//   → empresa nueva + dueño creados
//   → dueño recibe correo de bienvenida con datos de su empresa
//
// API pública:
//   - subject: string
//   - render({ name, companyName, rnc, planName, trialDays }) → { html, text }
//
// Datos requeridos: { companyName, trialDays }
// Datos opcionales: { name, rnc, planName }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Subject
// ------------------------------------------------------------
const subject = '¡Bienvenido a Expedinap Facturación!';

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ name, companyName, rnc, planName, trialDays }) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('welcome: companyName is required');
    if (!trialDays) throw new Error('welcome: trialDays is required');

    // 2. Datos escapados
    const safeName = escapeHtml(name || 'usuario');
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(rnc) : null;
    const safePlan = planName ? escapeHtml(planName) : null;
    const safeTrialDays = Number(trialDays);

    // 3. Bloque de datos de la empresa
    const companyBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
                <tr>
                    <td style="color:${BRAND.mutedColor};width:120px;">Empresa:</td>
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
            </table>
        </div>`;

    // 4. Bloque de trial
    const trialBlock = `
        <div style="background:#ecfdf5;border-left:4px solid #059669;padding:12px 16px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#065f46;line-height:1.5;">
                <strong>Período de prueba activo: ${safeTrialDays} días</strong><br>
                Tienes acceso completo a todas las funciones durante este tiempo.
            </div>
        </div>`;

    // 5. Body
    const bodyHtml = `
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Tu empresa ha sido registrada correctamente en ${escapeHtml(BRAND.name)} Facturación.</p>
        ${companyBlock}
        <p>Ya puedes iniciar sesión y comenzar a emitir facturas electrónicas.</p>
        ${trialBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si no creaste esta cuenta, por favor contacta a soporte inmediatamente.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 6. Texto plano
    const text =
        `Hola ${name || 'usuario'},\n\n` +
        `Tu empresa ${companyName} ha sido registrada correctamente en ${BRAND.name} Facturación.\n\n` +
        (rnc ? `RNC: ${rnc}\n` : '') +
        (planName ? `Plan: ${planName}\n` : '') +
        `\nYa puedes iniciar sesión y comenzar a emitir facturas electrónicas.\n\n` +
        `Período de prueba activo: ${safeTrialDays} días.\n` +
        `Tienes acceso completo a todas las funciones durante este tiempo.\n\n` +
        `Si no creaste esta cuenta, por favor contacta a soporte inmediatamente.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 7. Retorno
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { subject, render };