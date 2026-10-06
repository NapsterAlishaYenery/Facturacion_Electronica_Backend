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
    newCompanyAlert: require('./new-company-alert'),
    newCompanyAlert: require('./new-company-alert'),
    newUser: require('./new-user'),
    userStatusChanged: require('./user-status-changed'),
    certificateExpiring: require('./certificate-expiring'),
    sequencesAlert: require('./sequences-alert'),
    subscriptionExpiring: require('./subscription-expiring'),
    invoiceRejected: require('./invoice-rejected'),
    invoiceAccepted: require('./invoice-accepted'),
    invoiceRejectedByDgii: require('./invoice-rejected-by-dgii')
    // invoiceAccepted: require('./invoice-accepted'),    // ← futuro
    // invoiceRejected: require('./invoice-rejected'),    // ← futuro
};