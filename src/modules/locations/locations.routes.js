// ============================================================
// Rutas del módulo locations (provincias y municipios)
//
// Catálogos públicos (sin auth). Son datos que el front
// necesita para los selects del formulario de registro.
// ============================================================

const express = require('express');
const router = express.Router();

const { readLimiter } = require('../../shared/middlewares/rateLimit.middleware');

const locationsController = require('./locations.controller');

// ============================================================
// Health check del módulo
// ============================================================
router.get('/ping', (req, res) => {
    res.json({
        module: 'locations',
        status: 'ok',
        ready: true,
        message: 'Locations module ready (read-only).'
    });
});

// ============================================================
// Provincias (32)
// ============================================================
router.get('/provinces',
    readLimiter,
    locationsController.listProvinces
);

// ============================================================
// Municipios por provincia
// ============================================================
router.get('/provinces/:code/municipalities',
    readLimiter,
    locationsController.listMunicipalitiesByProvince
);

module.exports = router;