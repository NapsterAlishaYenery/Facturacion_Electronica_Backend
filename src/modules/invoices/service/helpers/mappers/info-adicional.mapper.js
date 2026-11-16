// ============================================================
// info-adicional.mapper.js
// Mapea el bloque <InformacionesAdicionales> del payload a columnas
// planas de Invoice. Aplica a 31, 32, 33, 34, 44, 45, 46.
// ============================================================

function mapInfoAdicionalFields(info) {
    if (!info) return {};

    return {
        // Básicos (ya existían)
        infoFechaEmbarque: info.fechaEmbarque ? new Date(info.fechaEmbarque) : null,
        infoNumeroEmbarque: info.numeroEmbarque || null,
        infoNumeroContenedor: info.numeroContenedor || null,
        infoNombrePuertoEmbarque: info.nombrePuertoEmbarque || null,
        infoCondicionesEntrega: info.condicionesEntrega || null,
        infoTotalFob: info.totalFob ?? null,
        infoSeguro: info.seguro ?? null,
        infoFlete: info.flete ?? null,
        infoOtrosGastos: info.otrosGastos ?? null,
        infoTotalCif: info.totalCif ?? null,
        infoRegimenAduanero: info.regimenAduanero || null,
        infoNombrePuertoSalida: info.nombrePuertoSalida || null,
        infoNombrePuertoDesembarque: info.nombrePuertoDesembarque || null,

        // DT30 — Nuevos de <InformacionesAdicionales>
        infoNumeroReferencia: info.numeroReferencia || null,
        infoPesoBruto: info.pesoBruto ?? null,
        infoPesoNeto: info.pesoNeto ?? null,
        infoUnidadPesoBruto: info.unidadPesoBruto ?? null,
        infoUnidadPesoNeto: info.unidadPesoNeto ?? null,
        infoCantidadBulto: info.cantidadBulto ?? null,
        infoUnidadBulto: info.unidadBulto ?? null,
        infoVolumenBulto: info.volumenBulto ?? null,
        infoUnidadVolumen: info.unidadVolumen ?? null
    };
}

module.exports = { mapInfoAdicionalFields };