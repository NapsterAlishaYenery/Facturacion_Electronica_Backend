// ============================================================
// Middleware de autenticación por API Key (FASE 18.2)
// ============================================================
//
// Flujo:
//   1. ¿Hay X-API-Key? → NO → next() sin req.user (authMiddleware hará JWT)
//   2. ¿Hay X-API-Key? → SÍ:
//      a. Hash SHA-256 de la key recibida
//      b. Buscar en api_keys (isActive: true)
//      c. Verificar expiresAt (si existe y ya pasó → 401 KEY_EXPIRED)
//      d. 🔥 Verificar que la empresa siga activa y con api_access en su plan
//         (si la key se creó en Enterprise pero bajó de plan → 403)
//      e. Buscar company_admin activo de la empresa dueña
//      f. Actualizar lastUsedAt (fire-and-forget)
//      g. Adjuntar req.user (con isApiKey: true) + req.apiKey
//      h. next()
//
// Seguridad:
//   - El secret nunca se loguea completo. Solo el prefix.
//   - Rate limit por key (apiKeyLimiter) se aplica antes de este middleware.
// ============================================================

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
    ApiKey,
    User,
    Company,
    Subscription,
    Plan
} = require('../../models');

async function apiKeyMiddleware(req, res, next) {
    try {
        const rawKey = req.headers['x-api-key'];
        if (!rawKey) return next(); // sin API key → authMiddleware hará JWT

        // 1. Hashear la key recibida
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        // 2. Buscar la key en BD (activa y no revocada)
        const apiKey = await ApiKey.findOne({
            where: { keyHash, isActive: true }
        });

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_API_KEY',
                    message: 'Invalid or revoked API key'
                }
            });
        }

        // 3. Verificar expiración (si aplica)
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) <= new Date()) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'API_KEY_EXPIRED',
                    message: 'API key has expired. Please create a new one.'
                }
            });
        }

        // 4. 🔥 Verificar que la empresa siga activa y con api_access en su plan
        //    (si la key se creó en Enterprise pero luego bajó de plan, debe rechazarse)
        const company = await Company.findByPk(apiKey.companyId, {
            attributes: ['id', 'isActive', 'isSystemOwner']
        });

        if (!company) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'API_KEY_COMPANY_NOT_FOUND',
                    message: 'The company of this API key no longer exists'
                }
            });
        }

        if (!company.isActive) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'API_KEY_COMPANY_INACTIVE',
                    message: 'The company of this API key is inactive'
                }
            });
        }

        // System owner tiene bypass (mismo criterio que assertApiAccessAllowed)
        if (!company.isSystemOwner) {
            const subscription = await Subscription.findOne({
                where: {
                    companyId: apiKey.companyId,
                    status: { [Op.in]: ['trial', 'active', 'past_due'] }
                },
                include: [{ model: Plan, as: 'plan', required: true }],
                order: [['createdAt', 'DESC']]
            });

            const apiAccessEnabled = subscription?.plan?.features?.api_access === true;

            if (!apiAccessEnabled) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'API_ACCESS_NOT_IN_PLAN',
                        message: 'The current plan does not include API access. Please upgrade to enterprise.'
                    }
                });
            }
        }

        // 5. Buscar el company_admin activo de la empresa dueña
        const user = await User.findOne({
            where: {
                companyId: apiKey.companyId,
                role: 'company_admin',
                isActive: true
            },
            attributes: { exclude: ['passwordHash'] }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'API_KEY_NO_ADMIN',
                    message: 'The company of this API key does not have an active admin'
                }
            });
        }

        // 6. Actualizar lastUsedAt (fire-and-forget, no bloquea)
        apiKey.update({ lastUsedAt: new Date() }).catch(() => { });

        // 7. Adjuntar user + apiKey al request
        //    isApiKey: true es la marca que usamos en read/writeLimiter
        //    para saltar el límite global (el apiKeyLimiter ya aplicó).
        user.isApiKey = true;
        req.user = user;
        req.apiKey = apiKey;

        next();
    } catch (error) {
        next(error);
    }
}

module.exports = apiKeyMiddleware;