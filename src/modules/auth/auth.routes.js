const express = require('express');
const router = express.Router();
const authMiddleware = require('../../shared/middlewares/auth.middleware');
const roleMiddleware = require('../../shared/middlewares/role.middleware');
const { AppError } = require('../../shared/middlewares/error.middleware');
const catchAsync = require('../../shared/utils/catchAsync');

router.get('/test/error-400', (req, res, next) => {
    next(new AppError('This is a test error 400', 400, 'TEST_ERROR'));
});

router.get('/test/error-403', (req, res, next) => {
    next(new AppError('Forbidden access', 403, 'FORBIDDEN'));
});

router.get('/test/error-404', (req, res, next) => {
    next(new AppError('Resource not found', 404, 'NOT_FOUND_RESOURCE'));
});

router.get('/test/error-500', (req, res, next) => {
    next(new Error('Simulated internal error'));
});

router.post('/test/error-validation',
    catchAsync(async (req, res) => {
        await User.create({}); // Falla validación (falta email, password, etc.)
    })
);

router.post('/test/error-unique',
    catchAsync(async (req, res) => {
        const { Company } = require('../../models');
        await Company.create({ rnc: req.body.rnc, name: 'Duplicate RNC Test' });
        res.json({ success: true });
    })
);

// Aquí irán las rutas de auth (login, registro, etc.)
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;