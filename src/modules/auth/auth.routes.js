const express = require('express');
const router = express.Router();

// Aquí irán las rutas de auth (login, registro, etc.)
router.get('/ping', (req, res) => {
    res.json({ module: 'auth', status: 'ok' });
});

module.exports = router;