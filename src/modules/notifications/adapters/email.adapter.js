// ============================================================
// Email adapter — wrapper de Nodemailer
//
// Responsabilidad única: enviar emails vía SMTP.
// NO conoce templates, ni negocio, ni branding.
//
// API pública:
//   send({ to, subject, html, text, bcc, from }) → info de Nodemailer
//   verify() → true si las credenciales SMTP funcionan
//   _resetTransporter() → solo para tests
//
// El transporter se crea de forma LAZY (en el primer send/verify)
// para que el server arranque aunque SMTP esté mal configurado.
//
// Los valores de configuración vienen de config/notifications.js.
// ============================================================

const nodemailer = require('nodemailer');
const config = require('../../../config/notifications');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Estado interno (transporter lazy)
// ------------------------------------------------------------
let transporter = null;

// ------------------------------------------------------------
// Construir el transporter desde el config centralizado
// ------------------------------------------------------------
function buildTransporter() {
    // 1. Validar que el config de email esté completo
    config.validateEmailConfig();

    // 2. Crear el transporter
    return nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,     // derivado del puerto (getter)
        auth: {
            user: config.email.user,
            pass: config.email.pass
        },
        tls: {
            // Algunos SMTP (Hostinger incluido) usan certs que Node
            // no reconoce por defecto. Permitimos la conexión.
            rejectUnauthorized: false
        }
    });
}

// ------------------------------------------------------------
// Obtener el transporter (crea en la primera llamada)
// ------------------------------------------------------------
function getTransporter() {
    if (!transporter) {
        transporter = buildTransporter();
    }
    return transporter;
}

// ------------------------------------------------------------
// Resolver el remitente por defecto (formato RFC: "Nombre <email>")
// ------------------------------------------------------------
function resolveFrom(explicitFrom) {
    // 1. Prioridad: argumento explícito
    if (explicitFrom) return explicitFrom;

    // 2. Luego config (SMTP_FROM)
    if (config.email.from) return config.email.from;

    // 3. Fallback: nombre de marca + SMTP_USER
    return `${BRAND.name} <${config.email.user}>`;
}

// ------------------------------------------------------------
// send — enviar un email
// ------------------------------------------------------------
async function send({ to, subject, html, text, bcc, from }) {
    // 1. Validaciones mínimas
    if (!to) throw new Error('email.adapter: "to" is required');
    if (!subject) throw new Error('email.adapter: "subject" is required');
    if (!html && !text) throw new Error('email.adapter: "html" or "text" is required');

    // 2. Construir opciones
    const mailOptions = {
        from: resolveFrom(from),
        to,
        subject,
        html,
        text,
        ...(bcc ? { bcc } : {})
    };

    // 3. Enviar
    try {
        const info = await getTransporter().sendMail(mailOptions);
        console.log(`[EMAIL-ADAPTER] Sent to ${to} | id=${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL-ADAPTER] Error sending to ${to}: ${error.message}`);
        throw error;
    }
}

// ------------------------------------------------------------
// verify — comprobar que las credenciales SMTP funcionan
// ------------------------------------------------------------
async function verify() {
    try {
        await getTransporter().verify();
        return true;
    } catch (error) {
        console.error(`[EMAIL-ADAPTER] Verify failed: ${error.message}`);
        return false;
    }
}

// ------------------------------------------------------------
// _resetTransporter — SOLO para tests
// ------------------------------------------------------------
function _resetTransporter() {
    transporter = null;
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
    send,
    verify,
    _resetTransporter
};