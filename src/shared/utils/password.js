// ============================================================
// Utilidades de contraseñas
// Funciones para hashear y comparar contraseñas
// NOTA: el modelo User ya hace hash automático con hooks
// Estas funciones son para casos externos (cambio de pass, seeds, etc.)
// ============================================================

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

// ------------------------------------------------------------
// Generar contraseña temporal aleatoria (para usuarios nuevos)
// Retorna string de 12 caracteres con mayúscula, minúscula,
// dígito y símbolo. Excluye caracteres ambiguos (0, O, I, l, 1).
// ------------------------------------------------------------
function generateTemporaryPassword(length = 12) {
    if (length < 8) {
        throw new Error('Password length must be at least 8 characters');
    }

    // 1. Char sets (sin caracteres ambiguos)
    const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz';
    const DIGITS = '23456789';
    const SYMBOLS = '!@#$%&*-_';
    const ALL = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

    // 2. Picker seguro con crypto (no Math.random)
    const pick = (charset) => charset[crypto.randomInt(0, charset.length)];

    // 3. Garantizar al menos 1 de cada tipo
    const required = [
        pick(UPPERCASE),
        pick(LOWERCASE),
        pick(DIGITS),
        pick(SYMBOLS)
    ];

    // 4. Rellenar el resto
    const rest = [];
    for (let i = required.length; i < length; i++) {
        rest.push(pick(ALL));
    }

    // 5. Mezclar (Fisher-Yates) para no dejar los "requeridos" al inicio
    const all = [...required, ...rest];
    for (let i = all.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [all[i], all[j]] = [all[j], all[i]];
    }

    return all.join('');
}

module.exports = {
    hashPassword,
    comparePassword,
    checkPasswordStrength,
    generateTemporaryPassword
};