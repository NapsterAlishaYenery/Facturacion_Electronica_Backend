// ============================================================
// Utilidades de generación de códigos
// ============================================================

const crypto = require('crypto');

// ------------------------------------------------------------
// Generar código numérico de 6 dígitos
// ------------------------------------------------------------
function generate6DigitCode() {
    return String(crypto.randomInt(100000, 999999));
}

// ------------------------------------------------------------
// Generar token aleatorio (para URLs, API keys, etc.)
// ------------------------------------------------------------
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

module.exports = {
    generate6DigitCode,
    generateToken
};