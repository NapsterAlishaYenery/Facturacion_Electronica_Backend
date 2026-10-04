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
// ============================================================

const nodemailer = require('nodemailer');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Estado interno (transporter lazy)
// ------------------------------------------------------------
let transporter = null;

// ------------------------------------------------------------
// Construir el transporter desde variables de entorno
// ------------------------------------------------------------
function buildTransporter() {
    // 1. Leer y validar env vars
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error(
            'email.adapter: SMTP_HOST, SMTP_USER and SMTP_PASS must be set'
        );
    }

    // 2. Crear el transporter
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,      // 465 = SSL directo; 587 = STARTTLS
        auth: { user, pass },
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

    // 2. Luego env var SMTP_FROM
    if (process.env.SMTP_FROM) return process.env.SMTP_FROM;

    // 3. Fallback: nombre de marca + SMTP_USER
    return `${BRAND.name} <${process.env.SMTP_USER}>`;
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