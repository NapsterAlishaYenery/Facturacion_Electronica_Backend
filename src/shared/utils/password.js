// ============================================================
// Utilidades de contraseñas
// Funciones para hashear y comparar contraseñas
// NOTA: el modelo User ya hace hash automático con hooks
// Estas funciones son para casos externos (cambio de pass, seeds, etc.)
// ============================================================

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

// ------------------------------------------------------------
// Hashear una contraseña en texto plano
// ------------------------------------------------------------
async function hashPassword(plainPassword) {
    if (!plainPassword || typeof plainPassword !== 'string') {
        throw new Error('Password must be a non-empty string');
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(plainPassword, salt);
}

// ------------------------------------------------------------
// Comparar contraseña en texto plano con hash
// ------------------------------------------------------------
async function comparePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
        return false;
    }

    return bcrypt.compare(plainPassword, hashedPassword);
}

// ------------------------------------------------------------
// Verificar fortaleza de contraseña
// Retorna { isValid, errors[] }
// ------------------------------------------------------------
function checkPasswordStrength(password) {
    const errors = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    hashPassword,
    comparePassword,
    checkPasswordStrength
};