// Dependencias
const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    writeLimiter
} = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones
const {
    registerCompanySchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    adminCreateUserSchema,
    companyCreateUserSchema,
    updateUserSchema,
    listUsersQuerySchema
} = require('./auth.validation');

// Controlador
const authController = require('./auth.controller');

// ============================================================
// Rutas públicas
// ============================================================

router.post('/register-company',
    registerLimiter,
    validate(registerCompanySchema),
    authController.registerCompany
);

router.post('/login',
    loginLimiter,
    validate(loginSchema),
    authController.login
);

router.post('/forgot-password',
    forgotPasswordLimiter,
    validate(forgotPasswordSchema),
    authController.forgotPassword
);

router.post('/reset-password',
    writeLimiter,
    validate(resetPasswordSchema),
    authController.resetPassword
);

router.post('/refresh',
    authController.refresh
);

// ============================================================
// Rutas autenticadas (self)
// ============================================================

router.post('/logout',
    authMiddleware,
    authController.logout
);

router.get('/me',
    authMiddleware,
    authController.me
);

router.patch('/me',
    authMiddleware,
    writeLimiter,
    validate(updateProfileSchema),
    authController.updateMe
);

router.patch('/change-password',
    authMiddleware,
    writeLimiter,
    validate(changePasswordSchema),
    authController.changePassword
);

// ============================================================
// Rutas de company_admin (MI EMPRESA)
// IMPORTANTE: van ANTES de las rutas /users/:id para que "company"
// no sea capturado como un :id
// ============================================================

router.get('/company/users',
    authMiddleware,
    roleMiddleware('company_admin'),
    validate(listUsersQuerySchema, 'query'),
    authController.listCompanyUsers
);

router.post('/company/users',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(companyCreateUserSchema),
    authController.createCompanyUser
);

router.patch('/company/users/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    validate(updateUserSchema),
    authController.updateCompanyUser
);

router.delete('/company/users/:id',
    authMiddleware,
    roleMiddleware('company_admin'),
    writeLimiter,
    authController.deleteCompanyUser
);

// ============================================================
// Rutas de admin (TODAS las empresas)
// ============================================================

router.get('/users',
    authMiddleware,
    roleMiddleware('admin'),
    validate(listUsersQuerySchema, 'query'),
    authController.listUsers
);

router.post('/users',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(adminCreateUserSchema),
    authController.createUser
);

router.patch('/users/:id/activate',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    validate(
        require('joi').object({ isActive: require('joi').boolean().required() })
    ),
    authController.toggleUserActive
);

router.delete('/users/:id',
    authMiddleware,
    roleMiddleware('admin'),
    writeLimiter,
    authController.deleteUser
);

// ============================================================
// Health check
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;