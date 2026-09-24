// ============================================================
// Middlewares de rate limiting
// Diferentes límites para diferentes tipos de operaciones
// ============================================================

const rateLimit = require('express-rate-limit');

// ------------------------------------------------------------
// Login: previene fuerza bruta
// ------------------------------------------------------------
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,                    // 5 intentos
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_LOGIN_ATTEMPTS',
            message: 'Too many login attempts. Please try again in 15 minutes.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // En desarrollo, no limitar (para tests)
    skip: () => process.env.NODE_ENV === 'development'
});

// ------------------------------------------------------------
// Registro: previene creación masiva de cuentas
// ------------------------------------------------------------
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,                    // 3 registros
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_REGISTRATIONS',
            message: 'Too many registration attempts. Please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development'
});

// ------------------------------------------------------------
// Forgot password: previene abuso de envío de emails
// ------------------------------------------------------------
const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_RESET_REQUESTS',
            message: 'Too many password reset requests. Please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development'
});

// ------------------------------------------------------------
// Escritura general: POST, PATCH, DELETE
// ------------------------------------------------------------
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_WRITE_REQUESTS',
            message: 'Too many write requests. Please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development'
});

// ------------------------------------------------------------
// Lectura general: GET
// ------------------------------------------------------------
const readLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_READ_REQUESTS',
            message: 'Too many requests. Please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'development'
});

module.exports = {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    writeLimiter,
    readLimiter
};