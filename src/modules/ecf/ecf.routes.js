const express = require('express');
const router = express.Router();

// Aquí irán las rutas de e-CF (generar, firmar, enviar)
router.get('/ping', (req, res) => {
    res.json({ module: 'ecf', status: 'ok' });
});

module.exports = router;