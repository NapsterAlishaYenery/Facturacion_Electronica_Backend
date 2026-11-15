const Joi = require('joi');

// ============================================================
// Informaciones adicionales — aplica a 31, 32, 33, 34, 44, 45, 46
// (excluido en 41, 43, 47 según el PDF DGII v1.0).
//
// Incluye TODOS los campos:
//   - Campos básicos de exportación (46): fechaEmbarque, puertoEmbarque, etc.
//   - Campos extendidos (31-34, 44-46): numeroReferencia, pesos, bultos.
//
// El generador (buildInformacionesAdicionales) ya filtra por perfil
// de tipo (type-profiles2.js), así que el schema puede ser permisivo
// y dejar que el perfil decida qué se emite en el XML.
// ============================================================
const informacionesAdicionalesSchema = Joi.object({
    // ---- Campos básicos (todos los tipos que soportan el bloque) ----
    fechaEmbarque: Joi.date().iso().optional().allow(null),
    numeroEmbarque: Joi.string().max(25).optional().allow(null, ''),
    numeroContenedor: Joi.string().max(100).optional().allow(null, ''),
    numeroReferencia: Joi.string().max(20).optional().allow(null, ''),

    // ---- Campos de exportación (46, opcionales en otros tipos) ----
    nombrePuertoEmbarque: Joi.string().max(40).optional().allow(null, ''),
    condicionesEntrega: Joi.string().max(3).optional().allow(null, ''),
    totalFob: Joi.number().min(0).optional().allow(null),
    seguro: Joi.number().min(0).optional().allow(null),
    flete: Joi.number().min(0).optional().allow(null),
    otrosGastos: Joi.number().min(0).optional().allow(null),
    totalCif: Joi.number().min(0).optional().allow(null),
    regimenAduanero: Joi.string().max(35).optional().allow(null, ''),
    nombrePuertoSalida: Joi.string().max(40).optional().allow(null, ''),
    nombrePuertoDesembarque: Joi.string().max(40).optional().allow(null, ''),

    // ---- Campos extendidos (pesos, bultos, volumen) ----
    pesoBruto: Joi.number().min(0).optional().allow(null),
    pesoNeto: Joi.number().min(0).optional().allow(null),
    unidadPesoBruto: Joi.number().integer().min(1).max(62).optional().allow(null),
    unidadPesoNeto: Joi.number().integer().min(1).max(62).optional().allow(null),
    cantidadBulto: Joi.number().min(0).optional().allow(null),
    unidadBulto: Joi.number().integer().min(1).max(62).optional().allow(null),
    volumenBulto: Joi.number().min(0).optional().allow(null),
    unidadVolumen: Joi.number().integer().min(1).max(62).optional().allow(null)
}).optional().allow(null);

module.exports = { informacionesAdicionalesSchema };