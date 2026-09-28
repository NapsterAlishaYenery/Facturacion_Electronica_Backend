const express = require('express');
const router = express.Router();

// Health check del módulo
router.get('/ping', (req, res) => {
    res.json({
        module: 'dgii',
        status: 'ok',
        ready: false,
        message: 'Module mounted. Pending certificate to implement.'
    });
});

module.exports = router;