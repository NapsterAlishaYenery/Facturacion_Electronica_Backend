// ============================================================
// Rutas del submódulo subscriptions
// ============================================================

const express = require('express');
const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ module: 'subscriptions', status: 'ok', ready: false });
});

module.exports = router;