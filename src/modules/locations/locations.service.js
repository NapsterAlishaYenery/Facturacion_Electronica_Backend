// ============================================================
// Servicio de ubicaciones (provincias y municipios)
//
// Catálogos estáticos de la división política de República
// Dominicana según la DGII (Tabla III). Read-only.
//
// NO requiere auth: son datos públicos que el front necesita
// para los selects de registro de empresa.
// ============================================================

const { Province, Municipality } = require('../../models');

// ------------------------------------------------------------
// Listar todas las provincias (32)
// ------------------------------------------------------------
async function listProvinces() {
    const provinces = await Province.findAll({
        attributes: ['dgiiCode', 'name'],
        order: [['name', 'ASC']]
    });

    return provinces;
}

// ------------------------------------------------------------
// Listar municipios de una provincia específica
// Falla con 404 si la provincia no existe
// ------------------------------------------------------------
async function listMunicipalitiesByProvince(provinceDgiiCode) {
    // 1. Verificar que la provincia exista
    const province = await Province.findByPk(provinceDgiiCode, {
        attributes: ['dgiiCode', 'name']
    });

    if (!province) {
        const { AppError } = require('../../shared/middlewares/error.middleware');
        throw new AppError(
            `Province with code ${provinceDgiiCode} not found`,
            404,
            'PROVINCE_NOT_FOUND'
        );
    }

    // 2. Traer sus municipios
    const municipalities = await Municipality.findAll({
        where: { provinceDgiiCode },
        attributes: ['dgiiCode', 'name', 'isDistrict'],
        order: [['name', 'ASC']]
    });

    return { province, municipalities };
}

module.exports = {
    listProvinces,
    listMunicipalitiesByProvince
};