// ============================================================
// Rate limiter específico para API Keys (FASE 18.2)
// ============================================================
//
// Se aplica SOLO cuando el request trae X-API-Key.
// Límite por KEY (no por IP, porque un POS puede estar
// detrás de una sola IP pública con varias sucursales).
//
// Uso en server.js:
//   app.use('/api', apiKeyLimiter, apiKeyMiddleware);
// ============================================================

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { RATE_LIMIT_PER_MIN } = require('../../constants/apiKeys');

// ipKeyGenerator: helper oficial de express-rate-limit que maneja
// correctamente IPv4 e IPv6 (evita el warning ERR_ERL_KEY_GEN_IPV6).
const { ipKeyGenerator } = rateLimit;

// ------------------------------------------------------------
// keyGenerator: usa el hash SHA-256 de la key como identificador
// del bucket. Nunca guardamos la key en claro en memoria del limiter.
// Si no hay key (no debería pasar por el `skip`), cae a IP con el
// helper oficial.
// ------------------------------------------------------------
function keyGenerator(req) {
    const rawKey = req.headers['x-api-key'];
    if (!rawKey) return ipKeyGenerator(req);

    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// ------------------------------------------------------------
// skip: solo aplica a requests con X-API-Key; en dev no limita.
// ------------------------------------------------------------
function skip(req) {
    if (!req.headers['x-api-key']) return true;
    return process.env.NODE_ENV === 'development';
}

const apiKeyLimiter = rateLimit({
    windowMs: 60 * 1000,               // 1 minuto
    max: RATE_LIMIT_PER_MIN,           // configurable, default 1000
    keyGenerator,
    skip,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_API_KEY_REQUESTS',
            message: `Rate limit exceeded for this API key (${RATE_LIMIT_PER_MIN} req/min). Please slow down.`
        }
    }
});

module.exports = apiKeyLimiter;