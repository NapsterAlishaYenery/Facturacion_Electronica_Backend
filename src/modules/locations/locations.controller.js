// ============================================================
// Controlador de ubicaciones (provincias y municipios)
// ============================================================

const locationsService = require('./locations.service');
const catchAsync = require('../../shared/utils/catchAsync');

// ------------------------------------------------------------
// GET /api/locations/provinces
// ------------------------------------------------------------
const listProvinces = catchAsync(async (req, res) => {
  const provinces = await locationsService.listProvinces(); // ← () al final

  res.json({
    success: true,
    message: 'Todas las provincias de RD',
    data: { provinces }
  });
});

// ------------------------------------------------------------
// GET /api/locations/provinces/:code/municipalities
// ------------------------------------------------------------
const listMunicipalitiesByProvince = catchAsync(async (req, res) => {
  const { code } = req.params;

  const { province, municipalities } = await locationsService.listMunicipalitiesByProvince(code); // ← nombre correcto

  res.json({
    success: true,
    message: 'Todos los municipios de la provincia',
    data: { province, municipalities }
  });
});

module.exports = {
  listProvinces,
  listMunicipalitiesByProvince
};