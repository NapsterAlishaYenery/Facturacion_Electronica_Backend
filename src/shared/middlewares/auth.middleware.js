// ============================================================
// Middleware de autenticación
// Verifica que el usuario esté autenticado con un JWT válido
// Adjunta el usuario a req.user si todo está bien
// ============================================================

const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../../models');

// ------------------------------------------------------------
// Extrae el token desde cookie o header Authorization
// Prioriza cookie (dashboard web) sobre header (apps móviles)
// ------------------------------------------------------------
function extractToken(req) {
    // 1. Intentar desde cookie
    if (req.cookies && req.cookies.access_token) {
        return req.cookies.access_token;
    }

    // 2. Intentar desde header Authorization: Bearer xxx
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7); // Quita "Bearer "
    }

    return null;
}

// ------------------------------------------------------------
// Middleware principal
// ------------------------------------------------------------
async function authMiddleware(req, res, next) {
    try {
        // 1. Extraer token
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'Authentication required. No token provided.'
                }
            });
        }

        // 2. Verificar token (lanza error si expiró o es inválido)
        let payload;
        try {
            payload = verifyAccessToken(token);
        } catch (error) {
            const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
            const message = error.name === 'TokenExpiredError'
                ? 'Token has expired. Please login again.'
                : 'Invalid token.';

            return res.status(401).json({
                success: false,
                error: { code, message }
            });
        }

        // 3. Buscar el usuario en la BD
        const user = await User.findByPk(payload.userId, {
            attributes: { exclude: ['passwordHash'] } // Nunca enviar el hash
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User no longer exists.'
                }
            });
        }

        // 4. Verificar que el usuario esté activo
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'USER_INACTIVE',
                    message: 'User account is inactive.'
                }
            });
        }

        // 5. Adjuntar el usuario a req.user
        req.user = user;

        // 6. Continuar
        next();
    } catch (error) {
        // Cualquier error inesperado → 500
        next(error);
    }
}

module.exports = authMiddleware;