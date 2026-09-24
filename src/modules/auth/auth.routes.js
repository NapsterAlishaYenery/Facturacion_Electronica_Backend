// Dependencias
const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
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
    resetPasswordSchema
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
// Rutas autenticadas
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
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;