// Dependencias
const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const validate = require('../../shared/middlewares/validate.middleware');
const { loginLimiter, registerLimiter } = require('../../shared/middlewares/rateLimit.middleware');

// Validaciones
const {
    registerCompanySchema,
    loginSchema
} = require('./auth.validation');

// Controlador
const authController = require('./auth.controller');

// ============================================================
// Rutas públicas
// ============================================================

// Registro de empresa + dueño
router.post('/register-company',
    registerLimiter,
    validate(registerCompanySchema),
    authController.registerCompany
);

// Login
router.post('/login',
    loginLimiter,
    validate(loginSchema),
    authController.login
);

// ============================================================
// Rutas autenticadas
// ============================================================

// Logout
router.post('/logout',
    authMiddleware,
    authController.logout
);

// Obtener usuario actual
router.get('/me',
    authMiddleware,
    authController.me
);

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;