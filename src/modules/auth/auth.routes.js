const express = require('express');
const router = express.Router();
const authMiddleware = require('../../shared/middlewares/auth.middleware');

// Aquí irán las rutas de auth (login, registro, etc.)
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;