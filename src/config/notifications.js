// ============================================================
// Notifications config — lee y valida env vars de notificaciones
//
// Centraliza el acceso a:
//   - SMTP (email)
//   - Futuro: WhatsApp, push
//
// Uso:
//   const config = require('../config/notifications');
//   config.email.host, config.email.port, ...
//
// El módulo se carga una sola vez (require cache) → valores fijos
// durante la vida del proceso.
// ============================================================

// ------------------------------------------------------------
// Helper interno: leer env var con default y validación
// ------------------------------------------------------------
function readEnv(key, { required = false, defaultValue } = {}) {
    const value = process.env[key];
    if ((value === undefined || value === '') && required) {
        throw new Error(`notifications config: missing required env var ${key}`);
    }
    return value !== undefined && value !== '' ? value : defaultValue;
}

// ------------------------------------------------------------
// Sección: email
// ------------------------------------------------------------
const email = {
    host: readEnv('SMTP_HOST'),
    port: Number(readEnv('SMTP_PORT', { defaultValue: 587 })),
    user: readEnv('SMTP_USER'),
    pass: readEnv('SMTP_PASS'),
    from: readEnv('SMTP_FROM'),  // opcional; si falta, adapter usa fallback
    get secure() {
        return this.port === 465;
    }
};

// ------------------------------------------------------------
// Sección: alertas internas
// Buzones donde Expedinap recibe notificaciones del sistema
// ------------------------------------------------------------
const alerts = {
    // Buzón que recibe alertas de nuevas empresas registradas
    registrationNotifyEmail: readEnv('REGISTRATION_NOTIFY_EMAIL')
};

// ------------------------------------------------------------
// Validación diferida: no lanzamos al requerir, sino cuando
// el adapter intenta usar el config. Esto permite que el server
// arranque aunque SMTP no esté configurado (útil en dev/test).
// ------------------------------------------------------------
function validateEmailConfig() {
    const missing = [];
    if (!email.host) missing.push('SMTP_HOST');
    if (!email.user) missing.push('SMTP_USER');
    if (!email.pass) missing.push('SMTP_PASS');

    if (missing.length > 0) {
        throw new Error(
            `notifications config: missing required SMTP env vars: ${missing.join(', ')}`
        );
    }
    return true;
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
    email,
    alerts,
    validateEmailConfig
};