// ============================================================
// Rutas del submódulo plans
// ============================================================

const express = require('express');
const router = express.Router();

router.get('/ping', (req, res) => {
    res.json({ module: 'plans', status: 'ok', ready: false });
});

module.exports = router;