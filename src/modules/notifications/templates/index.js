// ============================================================
// Notifications templates — barrel
//
// Importar así desde el service:
//   const { passwordResetCode } = require('./templates');
//   const { html, text } = passwordResetCode.render({ ... });
//   await adapter.send({ to, subject: passwordResetCode.subject, html, text });
// ============================================================

module.exports = {
    passwordResetCode: require('./password-reset-code'),
    welcome: require('./welcome'),
    newCompanyAlert: require('./new-company-alert')
    // invoiceAccepted: require('./invoice-accepted'),    // ← futuro
    // invoiceRejected: require('./invoice-rejected'),    // ← futuro
};