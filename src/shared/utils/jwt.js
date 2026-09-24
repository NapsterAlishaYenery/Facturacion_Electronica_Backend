// ============================================================
// Utilidades JWT
// Funciones para firmar, verificar y decodificar tokens
// ============================================================

const jwt = require('jsonwebtoken');

// ------------------------------------------------------------
// Generar access token (corta duración, se envía en cada request)
// Payload: { userId, role, companyId }
// ------------------------------------------------------------
function signAccessToken(payload) {
    return jwt.sign(
        {
            userId: payload.userId,
            role: payload.role,
            companyId: payload.companyId || null
        },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
            issuer: 'facturacion-electronica',
            audience: 'api'
        }
    );
}

// ------------------------------------------------------------
// Generar refresh token (larga duración, solo para renovar)
// Payload: { userId }
// ------------------------------------------------------------
function signRefreshToken(payload) {
    return jwt.sign(
        {
            userId: payload.userId,
            type: 'refresh' // Distingue de un access token
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
            issuer: 'facturacion-electronica',
            audience: 'refresh'
        }
    );
}

// ------------------------------------------------------------
// Verificar access token
// Lanza error si el token es inválido o está expirado
// ------------------------------------------------------------
function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        issuer: 'facturacion-electronica',
        audience: 'api'
    });
}

// ------------------------------------------------------------
// Verificar refresh token
// ------------------------------------------------------------
function verifyRefreshToken(token) {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'facturacion-electronica',
        audience: 'refresh'
    });

    if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
    }

    return payload;
}

// ------------------------------------------------------------
// Decodificar sin verificar (útil para debugging, NO usar en producción)
// ------------------------------------------------------------
function decodeToken(token) {
    return jwt.decode(token, { complete: true });
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken
};