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
// Exports
// ------------------------------------------------------------
module.exports = {
    sendPasswordResetCode
    // sendWelcome,               ← futuro (6.6)
    // sendInvoiceAccepted,       ← futuro (6.6)
    // sendInvoiceRejected,       ← futuro (6.6)
};