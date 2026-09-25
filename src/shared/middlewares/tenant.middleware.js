// ============================================================
// Middleware de multi-tenant
// Inyecta el companyId correcto según el rol del usuario
// Debe usarse DESPUÉS de authMiddleware
//
// Reglas:
// - admin: req.tenantCompanyId = null (puede ver todo)
// - company_admin / operator: req.tenantCompanyId = req.user.companyId
//
// Los servicios usan req.tenantCompanyId para filtrar por empresa.
// ============================================================


// ============================================================
// Middleware de multi-tenant (RESERVADO - NO SE USA ACTUALMENTE)
// ============================================================
//
// HISTORIA:
// Fue creado para inyectar req.tenantCompanyId según el rol del
// usuario, pero finalmente NO se adoptó este enfoque.
//
// SUSTITUTO ACTUAL:
// Cada servicio verifica el aislamiento multi-tenant manualmente.
// Ejemplo en companies.service.js, función listCompanies:
//
//     if (reqUser.role === 'company_admin') {
//         where.companyId = reqUser.companyId;
//     }
//
// Ventaja del enfoque actual:
// - Es más explícito y fácil de debuggear.
// - No requiere recordar inyectar el middleware en cada ruta.
// - El filtro vive cerca de la query SQL que lo usa.
//
// CUÁNDO REUTILIZARLO:
// Si en el futuro hay una ruta que necesite aplicar el filtro
// de tenant de forma sistemática (ej: reportes globales que
// siempre excluyan ciertos tenants), este middleware sirve.
//
// Se mantiene el archivo para evitar perder el diseño original.
// ============================================================

function tenantMiddleware(req, res, next) {
    // 1. Verificar que authMiddleware se haya ejecutado antes
    if (!req.user) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'MIDDLEWARE_MISCONFIGURED',
                message: 'tenantMiddleware requires authMiddleware to run first.'
            }
        });
    }

    // 2. Inyectar el companyId según el rol
    if (req.user.role === 'admin') {
        // El admin ve todo. No tiene restricción de tenant.
        req.tenantCompanyId = null;
    } else {
        // company_admin y operator solo ven su empresa
        if (!req.user.companyId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'NO_COMPANY_ASSIGNED',
                    message: 'User is not assigned to any company.'
                }
            });
        }
        req.tenantCompanyId = req.user.companyId;
    }

    // 3. Continuar
    next();
}

module.exports = tenantMiddleware;