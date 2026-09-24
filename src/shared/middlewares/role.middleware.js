// ============================================================
// Middleware de autorización por rol
// Verifica que el usuario autenticado tenga el rol requerido
// Debe usarse DESPUÉS de authMiddleware
// ============================================================

// Jerarquía de roles: número mayor = más privilegios
const ROLE_HIERARCHY = {
    operator: 1,
    company_admin: 2,
    admin: 3
};

// ------------------------------------------------------------
// Middleware factory
// Uso: roleMiddleware('admin') → solo admins
//      roleMiddleware('company_admin') → company_admin y admin
//      roleMiddleware('operator') → cualquiera autenticado
// ------------------------------------------------------------
function roleMiddleware(minimumRole) {
    return (req, res, next) => {
        // 1. Verificar que authMiddleware se haya ejecutado antes
        if (!req.user) {
            return res.status(500).json({
                success: false,
                error: {
                    code: 'MIDDLEWARE_MISCONFIGURED',
                    message: 'roleMiddleware requires authMiddleware to run first.'
                }
            });
        }

        // 2. Verificar que el rol mínimo sea válido
        if (!ROLE_HIERARCHY[minimumRole]) {
            return res.status(500).json({
                success: false,
                error: {
                    code: 'INVALID_ROLE',
                    message: `Unknown role: ${minimumRole}`
                }
            });
        }

        // 3. Comparar jerarquía
        const userLevel = ROLE_HIERARCHY[req.user.role];
        const requiredLevel = ROLE_HIERARCHY[minimumRole];

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `Access denied. Required role: ${minimumRole} or higher.`,
                    requiredRole: minimumRole,
                    currentRole: req.user.role
                }
            });
        }

        // 4. Todo bien
        next();
    };
}

module.exports = roleMiddleware;