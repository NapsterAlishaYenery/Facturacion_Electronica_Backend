// ============================================================
// Notifications service — API pública del módulo
//
// Orquesta:
//   1. Toma el template correspondiente (templates/index.js)
//   2. Renderiza el contenido ({ html, text })
//   3. Envía por el canal elegido (adapters/index.js)
//
// El resto de la app NUNCA importa adapters/ ni templates/
// directamente. Solo llama funciones de este archivo.
//
// Convención por función:
//   send<TemplateName>({ to, ...templateData }) → info del adapter
// ============================================================

const { getAdapter } = require('./adapters');
const templates = require('./templates');

// ------------------------------------------------------------
// sendPasswordResetCode — enviar código de recuperación (6 dígitos)
//
// Uso:
//   await notifications.sendPasswordResetCode({
//       to: user.email,
//       name: user.firstName,
//       code: '123456'
//   });
// ------------------------------------------------------------
async function sendPasswordResetCode({ to, name, code, expiresInMinutes }) {
    // 1. Renderizar el template
    const tpl = templates.passwordResetCode;
    const { html, text } = tpl.render({ name, code, expiresInMinutes });

    // 2. Enviar por el canal email
    const adapter = getAdapter('email');
    return adapter.send({
        to,
        subject: tpl.subject,
        html,
        text
    });
}

// ------------------------------------------------------------
// sendWelcome — correo de bienvenida al dueño de empresa nueva
// ------------------------------------------------------------
async function sendWelcome({ to, name, companyName, rnc, planName, trialDays }) {
    // 1. Renderizar el template
    const tpl = templates.welcome;
    const { html, text } = tpl.render({ name, companyName, rnc, planName, trialDays });

    // 2. Enviar
    const adapter = getAdapter('email');
    return adapter.send({
        to,
        subject: tpl.subject,
        html,
        text
    });
}

// ------------------------------------------------------------
// sendNewCompanyAlert — correo interno a Expedinap
// ------------------------------------------------------------
async function sendNewCompanyAlert({ to, company, owner, subscription, plan, meta }) {
    // 1. Renderizar el template
    const tpl = templates.newCompanyAlert;
    const { html, text } = tpl.render({ company, owner, subscription, plan, meta });

    // 2. Subject dinámico (incluye nombre de empresa)
    const subject = tpl.buildSubject({ company });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
    sendPasswordResetCode,
    sendWelcome,
    sendNewCompanyAlert
    // sendInvoiceAccepted,       ← futuro (6.6)
    // sendInvoiceRejected,       ← futuro (6.6)
};