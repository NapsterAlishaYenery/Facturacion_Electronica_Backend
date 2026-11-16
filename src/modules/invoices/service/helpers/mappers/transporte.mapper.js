// ============================================================
// transporte.mapper.js
// Mapea el bloque <Transporte> del payload a columnas planas de Invoice.
// Devuelve {} si no aplica (el Joi ya filtró por tipo).
// ============================================================

function mapTransporteFields(transporte) {
    if (!transporte) return {};

    return {
        transporteVia: transporte.viaTransporte || null,
        transportePaisOrigen: transporte.paisOrigen || null,
        transporteDireccionDestino: transporte.direccionDestino || null,
        transportePaisDestino: transporte.paisDestino || null,
        transporteRncCompania: transporte.rncCompaniaTransportista || null,
        transporteNombreCompania: transporte.nombreCompaniaTransportista || null,
        transporteNumeroViaje: transporte.numeroViaje || null,
        transporteConductor: transporte.conductor || null,
        transporteDocumento: transporte.documentoTransporte || null,
        transporteFicha: transporte.ficha || null,
        transportePlaca: transporte.placa || null,
        transporteRuta: transporte.rutaTransporte || null,
        transporteZona: transporte.zonaTransporte || null,
        transporteNumeroAlbaran: transporte.numeroAlbaran || null
    };
}

module.exports = { mapTransporteFields };