// src/modules/invoices/ecf/type-profiles.js
//
// ============================================================
// PERFILES COMPLETOS DE LOS 10 TIPOS DE e-CF DGII
// ============================================================
//
// Este archivo es la FUENTE DE VERDAD de qué campos existen en
// cada tipo de e-CF, según el PDF "Formato Comprobante Fiscal
// Electrónico (e-CF) V1.0" de DGII y los XSD oficiales.
//
// CÓDIGOS DE OBLIGATORIEDAD (por tipo, en orden 31|32|33|34|41|43|44|45|46|47):
//   1 = Obligatorio
//   2 = Condicional (obligatorio si se cumple una condición)
//   3 = Opcional
//   0 = No aplica (no debe ir en el XML)
//
// Formato de los comentarios:  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
// Campos nuevos de DT30-DT37:  // [NUEVO]
// Campos existentes:           // (sin marca, solo la obligatoriedad)
//
// ============================================================

'use strict';

const TYPE_PROFILES = {


    // ============================================================
    // 31 — Factura de Crédito Fiscal Electrónica
    // ============================================================
    '31': {
        code: '31',
        name: 'Factura de Crédito Fiscal Electrónica',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,                               // hasta 7 repeticiones

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: true,                              // 31: obligatorio | 41: obligatorio | 45: obligatorio

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: false,              // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: true,                      // 31: obligatorio | 41: obligatorio | 44: obligatorio | 45: obligatorio | 46: obligatorio

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: Invoice.receiverPais]

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,                                // 46 usa la variante extendida

            // 56. Fecha Embarque
            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 57. Número Embarque
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 58. Número Contenedor
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 59. Número Referencia
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            // 60. Nombre Puerto Embarque
            hasNombrePuertoEmbarque: true,                  // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 61. Condiciones Entrega
            hasCondicionesEntrega: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 62. Total FOB
            hasTotalFob: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 63. Seguro
            hasSeguro: true,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 64. Flete
            hasFlete: true,                                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 65. Otros Gastos
            hasOtrosGastos: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 66. Total CIF
            hasTotalCif: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 67. Régimen Aduanero
            hasRegimenAduanero: true,                       // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 68. Nombre Puerto Salida
            hasNombrePuertoSalida: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 69. Nombre Puerto Desembarque
            hasNombrePuertoDesembarque: true,               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 70. Peso Bruto
            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]

            // 71. Peso Neto
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]

            // 72. Unidad Peso Bruto
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]

            // 73. Unidad Peso Neto
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]

            // 74. Cantidad Bulto
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]

            // 75. Unidad Bulto
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]

            // 76. Volumen Bulto
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]

            // 77. Unidad Volumen
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,                                // 46 usa extendido
            reduced: false,                                 // 47 usa reducido

            // 78. Vía Transporte
            hasViaTransporte: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 79. País Origen
            hasPaisOrigen: true,                            // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 80. Dirección Destino
            hasDireccionDestino: true,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 81. País Destino
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3

            // 82. RNC Compañía Transportista
            hasRNCCompaniaTransportista: true,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 83. Nombre Compañía Transportista
            hasNombreCompaniaTransportista: true,           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 84. Número Viaje
            hasNumeroViaje: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 85. Conductor
            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 86. Documento Transporte
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 87. Ficha
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 88. Placa
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 89. Ruta Transporte
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 90. Zona Transporte
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 91. Número Albarán
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            impuestosAdicionalesMax: 20,                    // hasta 20 repeticiones

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: builder (ya existe columna)]

            // 117. Total ISR Retención
            hasTotalISRRetencion: true,                     // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2  // [NUEVO: builder (ya existe columna)]

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: true,                  // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalItbisPercepcion + builder]

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalIsrPercepcion + builder]
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: Invoice.montoGravadoTotalOtraMoneda]

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO: Invoice.montoGravado1OtraMoneda]

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO: Invoice.montoGravado2OtraMoneda]

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: Invoice.montoGravado3OtraMoneda]

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO: Invoice.montoExentoOtraMoneda]

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: Invoice.totalItbisOtraMoneda]

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO: Invoice.totalItbis1OtraMoneda]

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO: Invoice.totalItbis2OtraMoneda]

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: Invoice.totalItbis3OtraMoneda]

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicionalOtraMoneda]

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionalesOtraMoneda (JSONB)]

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.montoTotalOtraMoneda]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 31:100 | 32:10000 (<250K) o 1000 (>=250K) | resto: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // hasta 5 repeticiones  // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: true,                             // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: false,                       // obligatorio en 41 y 47
            hasRetencionIndicador: true,                    // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            hasMontoITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            hasMontoISRRetenido: true,                      // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:1

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: true,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 14. Unidad de Referencia
            hasUnidadReferencia: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0  // [NUEVO: InvoiceLine.subcantidades (JSONB) + builder]
            subcantidadMax: 5,                              // hasta 5 repeticiones

            // 17. Grados Alcohol
            hasGradosAlcohol: true,                         // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: true,              // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0  // [NUEVO: InvoiceLine.pesoNetoKilogramo, pesoNetoMineria, tipoAfiliacion, liquidacion + builder]
            hasPesoNetoKilogramo: false,                    // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasPesoNetoMineria: false,                      // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasTipoAfiliacion: false,                       // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasLiquidacion: false,                          // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,                            // hasta 12 repeticiones

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,                              // hasta 12 repeticiones

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            impuestoAdicionalItemMax: 2,                    // hasta 2 repeticiones

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: InvoiceLine.precioOtraMoneda, descuentoOtraMoneda, recargoOtraMoneda, montoItemOtraMoneda + builder]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,                              // hasta 20 repeticiones
            simple: false,                                  // 43, 46, 47 usan variante simple
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,                              // hasta 20 repeticiones
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,                        // solo si totalPaginas > 1
            simple: false,                                  // 43, 46, 47 usan variante simple
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // obligatorio solo en 33 y 34
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // Nota: la firma la hace el firmador externo, no el XML generator.
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: false,
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: false,
            retencionObligatoria: false,
        },
    },

    // ============================================================
    // 32 — Factura de Consumo Electrónica
    // ============================================================
    '32': {
        code: '32',
        name: 'Factura de Consumo Electrónica',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: false,            // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,                               // hasta 7 repeticiones

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,                             // 32: solo si total >= 250K
            rncConditional: {
                field: 'total',
                operator: '>=',
                value: 250000,
                // Regla: si total >= 250,000 → RNC obligatorio
            },

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            identificadorExtranjeroConditional: {
                field: 'total',
                operator: '>=',
                value: 250000,
                // Regla: si total >= 250,000 y no hay RNC → IdentificadorExtranjero obligatorio
            },

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: false,                     // 32: solo si total >= 250K
            razonSocialConditional: {
                field: 'total',
                operator: '>=',
                value: 250000,
            },

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: Invoice.receiverPais]

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,

            // 56. Fecha Embarque
            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 57. Número Embarque
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 58. Número Contenedor
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 59. Número Referencia
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            // 60. Nombre Puerto Embarque
            hasNombrePuertoEmbarque: true,                  // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 61. Condiciones Entrega
            hasCondicionesEntrega: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 62. Total FOB
            hasTotalFob: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 63. Seguro
            hasSeguro: true,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 64. Flete
            hasFlete: true,                                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 65. Otros Gastos
            hasOtrosGastos: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 66. Total CIF
            hasTotalCif: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 67. Régimen Aduanero
            hasRegimenAduanero: true,                       // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 68. Nombre Puerto Salida
            hasNombrePuertoSalida: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 69. Nombre Puerto Desembarque
            hasNombrePuertoDesembarque: true,               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 70. Peso Bruto
            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]

            // 71. Peso Neto
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]

            // 72. Unidad Peso Bruto
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]

            // 73. Unidad Peso Neto
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]

            // 74. Cantidad Bulto
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]

            // 75. Unidad Bulto
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]

            // 76. Volumen Bulto
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]

            // 77. Unidad Volumen
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: false,

            // 78. Vía Transporte
            hasViaTransporte: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 79. País Origen
            hasPaisOrigen: true,                            // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 80. Dirección Destino
            hasDireccionDestino: true,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 81. País Destino
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3

            // 82. RNC Compañía Transportista
            hasRNCCompaniaTransportista: true,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 83. Nombre Compañía Transportista
            hasNombreCompaniaTransportista: true,           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 84. Número Viaje
            hasNumeroViaje: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 85. Conductor
            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 86. Documento Transporte
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 87. Ficha
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 88. Placa
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 89. Ruta Transporte
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 90. Zona Transporte
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 91. Número Albarán
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            impuestosAdicionalesMax: 20,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0

            // 117. Total ISR Retención
            hasTotalISRRetencion: false,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO]

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 10000,                                // 32: 10000 si total < 250K; 1000 si total >= 250K
            maxItemsConditional: {
                field: 'total',
                operator: '<',
                value: 250000,
                max: 10000,
                elseMax: 1000,
            },

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: false,                            // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: false,
            hasRetencionIndicador: false,
            hasMontoITBISRetenido: false,
            hasMontoISRRetenido: false,

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: true,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 14. Unidad de Referencia
            hasUnidadReferencia: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0  // [NUEVO: InvoiceLine.subcantidades (JSONB) + builder]
            subcantidadMax: 5,

            // 17. Grados Alcohol
            hasGradosAlcohol: true,                         // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: true,              // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: true,                               // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0  // [NUEVO]
            hasPesoNetoKilogramo: true,                     // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasPesoNetoMineria: true,                       // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasTipoAfiliacion: true,                        // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasLiquidacion: true,                           // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            impuestoAdicionalItemMax: 2,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: false,
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: false,
            retencionObligatoria: false,
            // Regla especial 32:
            rncRequiredAboveAmount: 250000,                 // RNC + Razón Social obligatorios si total >= 250K
            maxItemsBelowAmount: 10000,                     // 10,000 líneas si total < 250K
            maxItemsAboveAmount: 1000,                      // 1,000 líneas si total >= 250K
        },
    },

    // ============================================================
    // 33 — Nota de Débito Electrónica
    // ============================================================
    '33': {
        code: '33',
        name: 'Nota de Débito Electrónica',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,                               // hasta 7 repeticiones

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 33: obligatoriedad 2 (condicional)
            // Se emite si la factura original (31/32) tenía comprador.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            presentConditional: {
                // Si la original era 32 < 250K y sin comprador → puede omitirse
                // Si la original tenía RNCComprador o RazonSocialComprador → debe emitirse
                dependsOn: 'originalInvoice',
                field: 'hasComprador',
            },

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,                             // 33: condicional (si la original tenía RNC)

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            identificadorExtranjeroConditional: {
                // Si la original tenía IdentificadorExtranjero → debe emitirse
                dependsOn: 'originalInvoice',
                field: 'hasIdentificadorExtranjero',
            },

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: false,                     // 33: condicional (si la original tenía Razón Social)

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: Invoice.receiverPais]

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,

            // 56. Fecha Embarque
            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 57. Número Embarque
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 58. Número Contenedor
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 59. Número Referencia
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            // 60. Nombre Puerto Embarque
            hasNombrePuertoEmbarque: true,                  // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 61. Condiciones Entrega
            hasCondicionesEntrega: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 62. Total FOB
            hasTotalFob: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 63. Seguro
            hasSeguro: true,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 64. Flete
            hasFlete: true,                                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 65. Otros Gastos
            hasOtrosGastos: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 66. Total CIF
            hasTotalCif: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 67. Régimen Aduanero
            hasRegimenAduanero: true,                       // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 68. Nombre Puerto Salida
            hasNombrePuertoSalida: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 69. Nombre Puerto Desembarque
            hasNombrePuertoDesembarque: true,               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 70. Peso Bruto
            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]

            // 71. Peso Neto
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]

            // 72. Unidad Peso Bruto
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]

            // 73. Unidad Peso Neto
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]

            // 74. Cantidad Bulto
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]

            // 75. Unidad Bulto
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]

            // 76. Volumen Bulto
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]

            // 77. Unidad Volumen
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: false,

            // 78. Vía Transporte
            hasViaTransporte: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 79. País Origen
            hasPaisOrigen: true,                            // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 80. Dirección Destino
            hasDireccionDestino: true,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 81. País Destino
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3

            // 82. RNC Compañía Transportista
            hasRNCCompaniaTransportista: true,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 83. Nombre Compañía Transportista
            hasNombreCompaniaTransportista: true,           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 84. Número Viaje
            hasNumeroViaje: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 85. Conductor
            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 86. Documento Transporte
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 87. Ficha
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 88. Placa
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 89. Ruta Transporte
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 90. Zona Transporte
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 91. Número Albarán
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            impuestosAdicionalesMax: 20,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: builder]

            // 117. Total ISR Retención
            hasTotalISRRetencion: true,                     // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2  // [NUEVO: builder]

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: true,                  // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalItbisPercepcion + builder]

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalIsrPercepcion + builder]
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO]

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 33: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: true,                             // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: false,                       // 33: condicional (2). Obligatorio solo en 41/47.
            hasRetencionIndicador: true,                    // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            hasMontoITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            hasMontoISRRetenido: true,                      // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:1

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: true,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 14. Unidad de Referencia
            hasUnidadReferencia: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0  // [NUEVO: InvoiceLine.subcantidades (JSONB) + builder]
            subcantidadMax: 5,

            // 17. Grados Alcohol
            hasGradosAlcohol: true,                         // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: true,              // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: true,                               // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0  // [NUEVO]
            hasPesoNetoKilogramo: true,                     // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasPesoNetoMineria: true,                       // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasTipoAfiliacion: true,                        // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasLiquidacion: true,                           // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            impuestoAdicionalItemMax: 2,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: true,                                 // [CRÍTICO] 33: obligatorio (1)
            hasRazonModificacion: true,                     // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0  // [CRÍTICO: opcional en 33]
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: true,                                   // [CRÍTICO] 33 es Nota de Débito
            isAutofactura: false,
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: false,
            retencionObligatoria: false,
            // Regla especial 33:
            requiresOriginalInvoice: true,                  // Debe referenciar un 31/32 emitido y aceptado
            originalInvoiceTypeAllowed: ['31', '32'],       // Solo puede modificar 31 o 32
            originalInvoiceStatusAllowed: ['sent', 'accepted'], // La original debe estar emitida
            maxModificationAgeDays: null,                   // 33 no tiene límite de días (a diferencia de 34 con IndicadorNotaCredito)
            codigoModificacionAllowed: [1, 2, 3, 4, 5],     // 1=Anular, 2=Corregir texto, 3=Corregir montos, 4=Reemplazo contingencia, 5=Referencia FC
        },
    },

    // ============================================================
    // 34 — Nota de Crédito Electrónica
    // ============================================================
    '34': {
        code: '34',
        name: 'Nota de Crédito Electrónica',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: false,            // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: true,                  // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0
            // 34: obligatorio (1). Valor:
            //   0 → la factura original tiene <= 30 días calendario
            //   1 → la factura original tiene > 30 días calendario

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: false,                          // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 34: NO aplica (0). A diferencia de 31/32/33/41/44/45/46/47 que sí.

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: false,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 34: NO aplica (0). Las notas de crédito no llevan formas de pago.
            formasPagoMax: 0,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: false,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 34: NO aplica (0).

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: false,                     // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 34: NO aplica (0).

            // 16. Banco de Pago
            hasBancoPago: false,                            // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 34: NO aplica (0).

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 34: obligatoriedad 2 (condicional)
            // Se emite si la factura original (31/32) tenía comprador.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            presentConditional: {
                dependsOn: 'originalInvoice',
                field: 'hasComprador',
            },

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,                             // 34: condicional (si la original tenía RNC)
            rncConditional: {
                // Si la original era 32 >= 250K → RNC obligatorio
                dependsOn: 'originalInvoice',
                field: 'total',
                operator: '>=',
                value: 250000,
            },

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            identificadorExtranjeroConditional: {
                dependsOn: 'originalInvoice',
                field: 'hasIdentificadorExtranjero',
            },

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: false,                     // 34: condicional (si la original tenía Razón Social)

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: Invoice.receiverPais]

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,

            // 56. Fecha Embarque
            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 57. Número Embarque
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 58. Número Contenedor
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]

            // 59. Número Referencia
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            // 60. Nombre Puerto Embarque
            hasNombrePuertoEmbarque: true,                  // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 61. Condiciones Entrega
            hasCondicionesEntrega: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 62. Total FOB
            hasTotalFob: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 63. Seguro
            hasSeguro: true,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 64. Flete
            hasFlete: true,                                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 65. Otros Gastos
            hasOtrosGastos: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 66. Total CIF
            hasTotalCif: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 67. Régimen Aduanero
            hasRegimenAduanero: true,                       // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 68. Nombre Puerto Salida
            hasNombrePuertoSalida: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 69. Nombre Puerto Desembarque
            hasNombrePuertoDesembarque: true,               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: builder]

            // 70. Peso Bruto
            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]

            // 71. Peso Neto
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]

            // 72. Unidad Peso Bruto
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]

            // 73. Unidad Peso Neto
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]

            // 74. Cantidad Bulto
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]

            // 75. Unidad Bulto
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]

            // 76. Volumen Bulto
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]

            // 77. Unidad Volumen
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: false,

            // 78. Vía Transporte
            hasViaTransporte: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 79. País Origen
            hasPaisOrigen: true,                            // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 80. Dirección Destino
            hasDireccionDestino: true,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 81. País Destino
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3

            // 82. RNC Compañía Transportista
            hasRNCCompaniaTransportista: true,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 83. Nombre Compañía Transportista
            hasNombreCompaniaTransportista: true,           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 84. Número Viaje
            hasNumeroViaje: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            // 85. Conductor
            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 86. Documento Transporte
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 87. Ficha
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 88. Placa
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 89. Ruta Transporte
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 90. Zona Transporte
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0

            // 91. Número Albarán
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            impuestosAdicionalesMax: 20,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: builder]

            // 117. Total ISR Retención
            hasTotalISRRetencion: true,                     // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2  // [NUEVO: builder]

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: true,                  // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalItbisPercepcion + builder]

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalIsrPercepcion + builder]
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO]

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 34: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: true,                             // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: false,                       // 34: condicional (2). Obligatorio solo en 41/47.
            hasRetencionIndicador: true,                    // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            hasMontoITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            hasMontoISRRetenido: true,                      // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:1

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: true,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 14. Unidad de Referencia
            hasUnidadReferencia: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0  // [NUEVO: InvoiceLine.subcantidades (JSONB) + builder]
            subcantidadMax: 5,

            // 17. Grados Alcohol
            hasGradosAlcohol: true,                         // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: true,              // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: true,                               // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0  // [NUEVO]
            hasPesoNetoKilogramo: true,                     // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasPesoNetoMineria: true,                       // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasTipoAfiliacion: true,                        // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasLiquidacion: true,                           // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            impuestoAdicionalItemMax: 2,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 34: MontoItem puede ser 0 cuando es corrección de texto
            montoItemCanBeZeroForTextCorrection: true,
            // Regla: si CodigoModificacion = 2 (corrección de texto), MontoItem = 0
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: true,                                 // [CRÍTICO] 34: obligatorio (1)
            hasRazonModificacion: true,                     // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0  // [CRÍTICO: opcional en 34]
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: true,                                   // [CRÍTICO] 34 es Nota de Crédito
            isAutofactura: false,
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: false,
            retencionObligatoria: false,
            indicadorNotaCreditoRequired: true,             // [CRÍTICO] 34: IndicadorNotaCredito obligatorio (0 o 1)
            // Reglas especiales 34:
            requiresOriginalInvoice: true,                  // Debe referenciar un 31/32 emitido y aceptado
            originalInvoiceTypeAllowed: ['31', '32'],       // Solo puede modificar 31 o 32
            originalInvoiceStatusAllowed: ['sent', 'accepted'],
            maxModificationAgeDays: 30,                     // Para calcular IndicadorNotaCredito:
            //   <= 30 días → IndicadorNotaCredito = 0
            //   >  30 días → IndicadorNotaCredito = 1
            codigoModificacionAllowed: [1, 2, 3, 4, 5],     // 1=Anular, 2=Corregir texto, 3=Corregir montos, 4=Reemplazo contingencia, 5=Referencia FC
            montoTotalMustBeLessOrEqualOriginal: true,      // [CRÍTICO] 34.total <= original.total
            // Regla de corrección de texto:
            textCorrection: {
                codigoModificacion: 2,                      // Si CodigoModificacion = 2 (Corrección de texto)
                montoItemCanBeZero: true,                   // MontoItem puede ser 0
            },
        },
    },

    // ============================================================
    // 41 — Comprobante de Compras Electrónico
    // ============================================================
    '41': {
        code: '41',
        name: 'Comprobante de Compras Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 41: NO aplica (0). Es comprobante de compras, no de ventas.

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: false,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 9. Tipo de Ingresos
            hasTipoIngresos: false,                         // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            // 41: NO aplica (0). No es una venta, es una compra.

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: false,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3
            // 41: NO aplica (0).

            // 18. Fecha hasta
            hasFechaHasta: false,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3
            // 41: NO aplica (0).

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0). No hay vendedor, es una compra.

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 35. Ruta de Venta
            hasRutaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 41: obligatoriedad 1 (obligatorio). Siempre debe ir.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: true,                              // [CRÍTICO] 41: RNC obligatorio

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: false,              // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            // 41: NO aplica (0).

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: true,                      // [CRÍTICO] 41: Razón Social obligatoria

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 41: NO aplica (0).

            // 47. Fecha Entrega
            hasFechaEntrega: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 48. Contacto Entrega
            hasContactoEntrega: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 49. Dirección Entrega
            hasDireccionEntrega: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 50. Teléfono Adicional
            hasTelefonoAdicional: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0).

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: false,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0). El bloque completo no se emite.
            extended: false,

            // Todos los campos has* son false porque el bloque no aplica.
            hasFechaEmbarque: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroEmbarque: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroContenedor: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroReferencia: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNombrePuertoEmbarque: false,                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasCondicionesEntrega: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalFob: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasSeguro: false,                               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFlete: false,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasOtrosGastos: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalCif: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasRegimenAduanero: false,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoSalida: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoDesembarque: false,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPesoBruto: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPesoNeto: false,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoBruto: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoNeto: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasCantidadBulto: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadBulto: false,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasVolumenBulto: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadVolumen: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: false,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 41: NO aplica (0). El bloque completo no se emite.
            extended: false,
            reduced: false,

            // Todos los campos has* son false porque el bloque no aplica.
            hasViaTransporte: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisOrigen: false,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: false,                     // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3
            hasRNCCompaniaTransportista: false,             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: false,          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasConductor: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: false,                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: false,                 // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).
            impuestosAdicionalesMax: 0,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: false,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 41: NO aplica (0).

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: builder]

            // 117. Total ISR Retención
            hasTotalISRRetencion: true,                     // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2  // [NUEVO: builder]

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: true,                  // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalItbisPercepcion + builder]

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0  // [NUEVO: Invoice.totalIsrPercepcion + builder]
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO]

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: false,     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: false,       // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 41: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: true,                             // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: true,                        // [CRÍTICO] 41: retención obligatoria (1)
            hasRetencionIndicador: true,                    // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            hasMontoITBISRetenido: true,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            hasMontoISRRetenido: true,                      // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:1
            // Nota 41: MontoISRRetenido es condicional a que indicadorBienoServicio = 2 (Servicio)

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: false,                   // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 14. Unidad de Referencia
            hasUnidadReferencia: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 41: NO aplica (0).
            subcantidadMax: 0,

            // 17. Grados Alcohol
            hasGradosAlcohol: false,                        // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: false,             // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 41: NO aplica (0).

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            // 41: NO aplica (0).
            hasPesoNetoKilogramo: false,
            hasPesoNetoMineria: false,
            hasTipoAfiliacion: false,
            hasLiquidacion: false,

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 41: NO aplica (0).
            impuestoAdicionalItemMax: 0,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 41: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: true,                            // [CRÍTICO] 41 es Autofactura
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: false,
            retencionObligatoria: true,                     // [CRÍTICO] 41: retención obligatoria
            // Reglas especiales 41:
            isCompras: true,                                // Es comprobante de compras (no de ventas)
            montoISRRetenidoConditional: {
                // MontoISRRetenido es condicional a indicadorBienoServicio = 2 (Servicio)
                dependsOn: 'indicadorBienoServicio',
                value: 2,
            },
        },
    },


    // ============================================================
    // 43 — Comprobante de Gastos Menores Electrónico
    // ============================================================
    '43': {
        code: '43',
        name: 'Comprobante de Gastos Menores Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0). El 43 es solo exento, no hay monto gravado.

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: false,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 9. Tipo de Ingresos
            hasTipoIngresos: false,                         // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            // 43: NO aplica (0).

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            // 43: opcional (3). Pero en la práctica siempre va (default 1).
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: false,                      // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3
            // 43: NO aplica (0).

            // 12. Término de Pago
            hasTerminoPago: false,                          // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: false,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).
            formasPagoMax: 0,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: false,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: false,                     // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 16. Banco de Pago
            hasBancoPago: false,                            // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 17. Fecha desde
            hasFechaDesde: false,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 18. Fecha hasta
            hasFechaHasta: false,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3
            // 43: NO aplica (0).

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0).

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0).

            // 35. Ruta de Venta
            hasRutaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0).

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 43: obligatoriedad 0 (NO aplica). El 43 NO lleva comprador.
            // Es un comprobante para gastos menores del emisor, sin identificar comprador.
            present: false,                                 // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // Todos los campos has* son false porque el bloque no aplica.
            hasRNCComprador: false,                         // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,

            hasIdentificadorExtranjero: false,              // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            hasRazonSocialComprador: false,                 // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: false,

            hasContactoComprador: false,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasCorreoComprador: false,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasDireccionComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasMunicipioComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasProvinciaComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFechaEntrega: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasContactoEntrega: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDireccionEntrega: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasTelefonoAdicional: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFechaOrdenCompra: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroOrdenCompra: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasCodigoInternoComprador: false,               // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasResponsablePago: false,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasInformacionAdicionalComprador: false,        // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: false,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0). El bloque completo no se emite.
            extended: false,

            hasFechaEmbarque: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroEmbarque: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroContenedor: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroReferencia: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNombrePuertoEmbarque: false,                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasCondicionesEntrega: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalFob: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasSeguro: false,                               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFlete: false,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasOtrosGastos: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalCif: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasRegimenAduanero: false,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoSalida: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoDesembarque: false,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPesoBruto: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPesoNeto: false,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoBruto: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoNeto: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasCantidadBulto: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadBulto: false,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasVolumenBulto: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadVolumen: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: false,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0). El bloque completo no se emite.
            extended: false,
            reduced: false,

            hasViaTransporte: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisOrigen: false,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: false,                     // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3
            hasRNCCompaniaTransportista: false,             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: false,          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasConductor: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: false,                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: false,                    // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0). El 43 es solo exento.

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 43: SIEMPRE lleva MontoExento. Es el único monto que lleva.

            // 97. ITBIS Tasa 1
            hasITBIS1: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 98. ITBIS Tasa 2
            hasITBIS2: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 99. ITBIS Tasa 3
            hasITBIS3: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 100. Total ITBIS
            hasTotalITBIS: false,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0). El 43 no lleva ITBIS.

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: false,                 // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).
            impuestosAdicionalesMax: 0,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 43: SIEMPRE lleva MontoTotal.

            // 111. Monto No Facturable
            hasMontoNoFacturable: false,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 43: NO aplica (0).

            // 117. Total ISR Retención
            hasTotalISRRetencion: false,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2
            // 43: NO aplica (0).

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 43: NO aplica (0).

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 43: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            // 43: aplica (2) pero en la práctica pocas veces. Se emite solo si hay moneda extranjera.

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: false,          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 43: SIEMPRE lleva MontoExentoOtraMoneda si hay moneda extranjera.

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: false,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: false,     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: false,       // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            // [CRÍTICO] 43: SIEMPRE lleva MontoTotalOtraMoneda si hay moneda extranjera.
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 43: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 43: indicadorFacturacion DEBE SER 4 (Exento) en todos los ítems.
            indicadorFacturacionForced: 4,

            // 5-7. Bloque Retención
            hasRetencion: false,                            // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            // 43: NO aplica (0).
            retencionRequired: false,
            hasRetencionIndicador: false,
            hasMontoITBISRetenido: false,
            hasMontoISRRetenido: false,

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: false,                   // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 14. Unidad de Referencia
            hasUnidadReferencia: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).
            subcantidadMax: 0,

            // 17. Grados Alcohol
            hasGradosAlcohol: false,                        // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: false,             // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 43: NO aplica (0).

            // 19. Fecha Elaboración
            hasFechaElaboracion: false,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0).

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: false,                 // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 43: NO aplica (0).

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            // 43: NO aplica (0).
            hasPesoNetoKilogramo: false,
            hasPesoNetoMineria: false,
            hasTipoAfiliacion: false,
            hasLiquidacion: false,

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: false,                    // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).
            subDescuentoMax: 0,

            // 30. Monto Recargo
            hasRecargoMonto: false,                         // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: false,                      // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0).
            subRecargoMax: 0,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 43: NO aplica (0).
            impuestoAdicionalItemMax: 0,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            // 43: aplica (2).
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: true,                                   // 43 usa variante simple
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: false,                                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 43: NO aplica (0). El bloque completo no se emite.
            maxDescuentos: 0,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: true,                                   // 43 usa variante simple
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 43: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: true,                            // [CRÍTICO] 43 es Autofactura
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: false,                       // [CRÍTICO] 43 no maneja ITBIS transparente
            itbisObligatorioCero: true,                     // [CRÍTICO] 43 siempre es exento
            retencionObligatoria: false,
            maxMontoTotal: 25000,                           // [CRÍTICO] 43 no puede exceder RD$25,000
            // Reglas especiales 43:
            isGastosMenores: true,                          // Es comprobante de gastos menores
            requireAllItemsExempt: true,                    // [CRÍTICO] Todos los ítems deben ser indicadorFacturacion = 4
            noComprador: true,                              // [CRÍTICO] No lleva comprador
            noTransporte: true,                             // [CRÍTICO] No lleva transporte
            noInformacionesAdicionales: true,               // [CRÍTICO] No lleva info adicional
            noImpuestosAdicionales: true,                   // [CRÍTICO] No lleva impuestos adicionales
            noRetenciones: true,                            // [CRÍTICO] No lleva retenciones
            noDescuentosGlobales: true,                     // [CRÍTICO] No lleva descuentos/recargos globales
        },
    },


    // ============================================================
    // 44 — Comprobante de Regímenes Especiales Electrónico
    // ============================================================
    '44': {
        code: '44',
        name: 'Comprobante de Regímenes Especiales Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0). El 44 es solo exento, no hay monto gravado.

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 44: obligatoriedad 1 (obligatorio). Siempre debe ir.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,                             // 44: condicional (2). No siempre obligatorio.

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            identificadorExtranjeroConditional: {
                // Condicional a que el comprador sea extranjero
                dependsOn: 'receiverRnc',
                field: 'isEmpty',
            },

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: true,                      // [CRÍTICO] 44: Razón Social obligatoria

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 44: NO aplica (0).

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,

            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            hasNombrePuertoEmbarque: false,                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 44: NO aplica (0). Solo 46 lo lleva.
            hasCondicionesEntrega: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalFob: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasSeguro: false,                               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFlete: false,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasOtrosGastos: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalCif: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasRegimenAduanero: false,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoSalida: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoDesembarque: false,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: false,

            hasViaTransporte: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 44: NO aplica (0). Solo 46 lo lleva.
            hasPaisOrigen: false,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: false,                     // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3
            hasRNCCompaniaTransportista: false,             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: false,          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: false,                    // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0). Solo exento.

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 44: SIEMPRE lleva MontoExento.

            // 97. ITBIS Tasa 1
            hasITBIS1: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 98. ITBIS Tasa 2
            hasITBIS2: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 99. ITBIS Tasa 3
            hasITBIS3: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 100. Total ITBIS
            hasTotalITBIS: false,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]
            // [CRÍTICO] 44: SÍ aplica (a diferencia de 43).

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            // [CRÍTICO] 44: SÍ aplica (a diferencia de 43).
            impuestosAdicionalesMax: 20,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]
            // 44: SÍ aplica (2).

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 44: NO aplica (0).

            // 117. Total ISR Retención
            hasTotalISRRetencion: false,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2
            // 44: NO aplica (0).

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 44: NO aplica (0).

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 44: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 120. Tipo de Moneda
            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]

            // 121. Tipo de Cambio
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            // 122. Monto Gravado Total Otra Moneda
            hasMontoGravadoTotalOtraMoneda: false,          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 123. Monto Gravado 1 Otra Moneda
            hasMontoGravado1OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 124. Monto Gravado 2 Otra Moneda
            hasMontoGravado2OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 125. Monto Gravado 3 Otra Moneda
            hasMontoGravado3OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 126. Monto Exento Otra Moneda
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 44: SIEMPRE lleva MontoExentoOtraMoneda si hay moneda extranjera.

            // 127. Total ITBIS Otra Moneda
            hasTotalITBISOtraMoneda: false,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 128. Total ITBIS 1 Otra Moneda
            hasTotalITBIS1OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 129. Total ITBIS 2 Otra Moneda
            hasTotalITBIS2OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 130. Total ITBIS 3 Otra Moneda
            hasTotalITBIS3OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 44: NO aplica (0).

            // 131. Monto Impuesto Adicional Otra Moneda
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            // [CRÍTICO] 44: SÍ aplica.

            // 132-136. Impuestos Adicionales Otra Moneda (tabla)
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            // [CRÍTICO] 44: SÍ aplica.

            // 137. Monto Total Otra Moneda
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 44: 100

            // 1. Número de Línea
            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2-3. Tabla Códigos Ítem
            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            // 4. Indicador de Facturación
            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 44: indicadorFacturacion DEBE SER 4 (Exento) en todos los ítems.
            indicadorFacturacionForced: 4,

            // 5-7. Bloque Retención
            hasRetencion: false,                            // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            // 44: NO aplica (0).
            retencionRequired: false,
            hasRetencionIndicador: false,
            hasMontoITBISRetenido: false,
            hasMontoISRRetenido: false,

            // 8. Nombre del Ítem
            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 9. Indicador Bien o Servicio
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 10. Descripción Adicional
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 11. Cantidad
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 12. Unidad de Medida
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 13. Cantidad de Referencia
            hasCantidadReferencia: false,                   // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 14. Unidad de Referencia
            hasUnidadReferencia: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 15-16. Tabla Subcantidad
            hasTablaSubcantidad: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).
            subcantidadMax: 0,

            // 17. Grados Alcohol
            hasGradosAlcohol: false,                        // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 18. Precio Unitario de Referencia
            hasPrecioUnitarioReferencia: false,             // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 44: NO aplica (0).

            // 19. Fecha Elaboración
            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 20. Fecha Vencimiento Ítem
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            // 44: NO aplica (0).
            hasPesoNetoKilogramo: false,
            hasPesoNetoMineria: false,
            hasTipoAfiliacion: false,
            hasLiquidacion: false,

            // 25. Precio Unitario del Ítem
            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            // 30. Monto Recargo
            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            // [CRÍTICO] 44: SÍ aplica (a diferencia de 43).
            impuestoAdicionalItemMax: 2,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            // 39. Monto Ítem
            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 44: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: true,                            // [CRÍTICO] 44 es Autofactura
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: false,                       // [CRÍTICO] 44 no maneja ITBIS transparente
            itbisObligatorioCero: true,                     // [CRÍTICO] 44 siempre es exento
            retencionObligatoria: false,
            // Reglas especiales 44:
            isRegimenEspecial: true,                        // Es comprobante de regímenes especiales
            requireAllItemsExempt: true,                    // [CRÍTICO] Todos los ítems deben ser indicadorFacturacion = 4
            noRetenciones: true,                            // [CRÍTICO] No lleva retenciones
            maxMontoTotal: null,                            // Sin límite de monto (a diferencia de 43)
            allowsImpuestosAdicionales: true,               // [CRÍTICO] SÍ permite impuestos adicionales
        },
    },

    // ============================================================
    // 45 — Comprobante Gubernamental Electrónico
    // ============================================================
    '45': {
        code: '45',
        name: 'Comprobante Gubernamental Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            indicadorMontoGravadoRequired: false,           // condicional

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: true,         // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            indicadorServicioTodoIncluidoRequired: false,   // condicional

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 45: obligatoriedad 1 (obligatorio). Siempre debe ir.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: true,                              // [CRÍTICO] 45: RNC obligatorio (ente gubernamental)

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: false,              // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            // 45: NO aplica (0). El comprador siempre es una entidad gubernamental dominicana con RNC.

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: true,                      // [CRÍTICO] 45: Razón Social obligatoria

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 45: NO aplica (0).

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,

            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            hasNombrePuertoEmbarque: false,                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasCondicionesEntrega: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalFob: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasSeguro: false,                               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFlete: false,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasOtrosGastos: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalCif: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasRegimenAduanero: false,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoSalida: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoDesembarque: false,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte>
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: false,

            hasViaTransporte: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisOrigen: false,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: false,                     // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3
            hasRNCCompaniaTransportista: false,             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: false,          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2

            // 97. ITBIS Tasa 1
            hasITBIS1: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 98. ITBIS Tasa 2
            hasITBIS2: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO: builder full]

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.montoImpuestoAdicional + builder]

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: true,                  // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: Invoice.impuestosAdicionales (JSONB) + builder]
            impuestosAdicionalesMax: 20,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 45: NO aplica (0). El gubernamental no lleva retenciones.

            // 117. Total ISR Retención
            hasTotalISRRetencion: false,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2
            // 45: NO aplica (0).

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 45: NO aplica (0).

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 45: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]
            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasMontoGravado1OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            hasMontoGravado2OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2  // [NUEVO]
            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasTotalITBIS1OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            hasTotalITBIS2OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0  // [NUEVO]
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasMontoImpuestoAdicionalOtraMoneda: true,      // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            hasImpuestosAdicionalesOtraMoneda: true,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO]
            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 45: 100

            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 5-7. Bloque Retención
            hasRetencion: false,                            // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            // 45: NO aplica (0).
            retencionRequired: false,
            hasRetencionIndicador: false,
            hasMontoITBISRetenido: false,
            hasMontoISRRetenido: false,

            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            hasCantidadReferencia: true,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            hasUnidadReferencia: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            hasTablaSubcantidad: true,                      // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0  // [NUEVO: InvoiceLine.subcantidades (JSONB) + builder]
            subcantidadMax: 5,

            hasGradosAlcohol: true,                         // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            hasPrecioUnitarioReferencia: true,              // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0

            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            // 45: NO aplica (0).
            hasPesoNetoKilogramo: false,
            hasPesoNetoMineria: false,
            hasTipoAfiliacion: false,
            hasLiquidacion: false,

            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            hasTablaImpuestoAdicional: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0  // [NUEVO: InvoiceLine.impuestosAdicionales (JSONB) + builder]
            impuestoAdicionalItemMax: 2,

            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: false,
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: false,
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 45: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: true,                            // [CRÍTICO] 45 es Autofactura (el Estado es el comprador)
            isExportacion: false,
            isPagoExterior: false,
            itbisTransparente: true,                        // [CRÍTICO] 45 maneja ITBIS transparente
            itbisObligatorioCero: false,
            retencionObligatoria: false,
            isGubernamental: true,                          // [CRÍTICO] 45 es gubernamental
            // Reglas especiales 45:
            requiresGovernmentRnc: true,                    // [CRÍTICO] El comprador debe ser una entidad gubernamental con RNC
            noRetenciones: true,                            // [CRÍTICO] No lleva retenciones (ni por línea ni en totales)
            noMineria: true,                                // No aplica minería
        },
    },

    // ============================================================
    // 46 — Comprobante de Exportaciones Electrónico
    // ============================================================
    '46': {
        code: '46',
        name: 'Comprobante de Exportaciones Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: true,                // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO]
            indicadorEnvioDiferidoRequired: false,          // condicional

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0). Las exportaciones no llevan monto gravado en el sentido tradicional.

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: false,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 9. Tipo de Ingresos
            hasTipoIngresos: true,                          // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            tipoIngresosDefault: '01',                      // [NUEVO]

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoVendedor]

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.zonaVenta]

            // 35. Ruta de Venta
            hasRutaVenta: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.rutaVenta]

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 46: obligatoriedad 1 (obligatorio). Siempre debe ir.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: true,                          // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            rncRequired: false,                             // 46: condicional (2). El comprador extranjero no tiene RNC dominicano.
            // Regla: RNC obligatorio si el comprador es dominicano. Si es extranjero, va IdentificadorExtranjero.

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            // [CRÍTICO] 46: condicional (2). Obligatorio si el comprador es extranjero y no tiene RNC.
            identificadorExtranjeroConditional: {
                // Si no hay RNC → IdentificadorExtranjero obligatorio
                dependsOn: 'receiverRnc',
                field: 'isEmpty',
            },

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            razonSocialRequired: true,                      // [CRÍTICO] 46: Razón Social obligatoria

            // 41. Contacto Comprador
            hasContactoComprador: true,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoComprador]

            // 42. Correo Comprador
            hasCorreoComprador: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.correoComprador]

            // 43. Dirección Comprador
            hasDireccionComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionComprador]

            // 44. Municipio Comprador
            hasMunicipioComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.municipioComprador]

            // 45. Provincia Comprador
            hasProvinciaComprador: true,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.provinciaComprador]

            // 46. País Comprador
            hasPaisComprador: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [NUEVO: Invoice.receiverPais]
            // [CRÍTICO] 46: obligatorio (3). Es el país del comprador extranjero.

            // 47. Fecha Entrega
            hasFechaEntrega: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaEntrega]

            // 48. Contacto Entrega
            hasContactoEntrega: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.contactoEntrega]

            // 49. Dirección Entrega
            hasDireccionEntrega: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.direccionEntrega]

            // 50. Teléfono Adicional
            hasTelefonoAdicional: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.telefonoAdicional]

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.fechaOrdenCompra]

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: true,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.numeroOrdenCompra]

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: true,                // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.codigoInternoComprador]

            // 54. Responsable Pago
            hasResponsablePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.responsablePago]

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: true,         // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.informacionAdicionalComprador]
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales> (EXTENDIDO para 46)
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: true,                                 // [CRÍTICO] 46 usa la variante extendida con TODOS los campos de exportación.

            hasFechaEmbarque: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroEmbarque: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroContenedor: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: builder]
            hasNumeroReferencia: true,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoNumeroReferencia + builder]

            hasNombrePuertoEmbarque: true,                  // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasCondicionesEntrega: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasTotalFob: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasSeguro: true,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasFlete: true,                                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasOtrosGastos: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasTotalCif: true,                              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasRegimenAduanero: true,                       // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasNombrePuertoSalida: true,                    // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).
            hasNombrePuertoDesembarque: true,               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0  // [CRÍTICO] 46: SÍ aplica (solo 46).

            hasPesoBruto: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoBruto + builder]
            hasPesoNeto: true,                              // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoPesoNeto + builder]
            hasUnidadPesoBruto: true,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoBruto + builder]
            hasUnidadPesoNeto: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadPesoNeto + builder]
            hasCantidadBulto: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoCantidadBulto + builder]
            hasUnidadBulto: true,                           // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadBulto + builder]
            hasVolumenBulto: true,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoVolumenBulto + builder]
            hasUnidadVolumen: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0  // [NUEVO: Invoice.infoUnidadVolumen + builder]
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte> (EXTENDIDO para 46)
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: true,                                 // [CRÍTICO] 46 usa la variante extendida con TODOS los campos de exportación.
            reduced: false,

            // [CRÍTICO] 46: SÍ aplica la variante extendida. A diferencia de 31/32/33/34/44/45 que solo usan "full".
            hasViaTransporte: true,                         // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisOrigen: true,                            // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: true,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3
            hasRNCCompaniaTransportista: true,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: true,           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0

            hasConductor: true,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: true,                   // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: true,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: true,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: true,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 46: SÍ aplica (2). Es el monto gravado total de la exportación.

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0). Las exportaciones no llevan ITBIS 18%.

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0). Las exportaciones no llevan ITBIS 16%.

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // [CRÍTICO] 46: SÍ aplica (2). Es la base gravada a tasa 0% (exportación).

            // 96. Monto Exento
            hasMontoExento: false,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // 46: NO aplica (0).

            // 97. ITBIS Tasa 1
            hasITBIS1: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 98. ITBIS Tasa 2
            hasITBIS2: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 99. ITBIS Tasa 3
            hasITBIS3: true,                                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // [CRÍTICO] 46: SÍ aplica (2). Es la tasa 0% de exportación.

            // 100. Total ITBIS
            hasTotalITBIS: true,                            // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 46: SÍ aplica (2). Es el total de ITBIS (0).

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: true,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [CRÍTICO] 46: SÍ aplica.
            // [CRÍTICO] 46: SÍ aplica (2). Es el total ITBIS 0% de exportación.

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: false,                 // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).
            impuestosAdicionalesMax: 0,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 111. Monto No Facturable
            hasMontoNoFacturable: true,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0  // [NUEVO: Invoice.montoNoFacturable + builder]

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 46: NO aplica (0).

            // 117. Total ISR Retención
            hasTotalISRRetencion: false,                    // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2
            // 46: NO aplica (0).

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 46: NO aplica (0).

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 46: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]
            // [CRÍTICO] 46: SIEMPRE debería ir en USD/EUR por ser exportación.

            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            hasMontoGravadoTotalOtraMoneda: true,           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasMontoGravado1OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasMontoGravado2OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasMontoGravado3OtraMoneda: true,               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            // [CRÍTICO] 46: SÍ aplica (2). Es la base gravada a tasa 0% en otra moneda.

            hasMontoExentoOtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // 46: NO aplica (0).

            hasTotalITBISOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            hasTotalITBIS1OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasTotalITBIS2OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasTotalITBIS3OtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0  // [NUEVO]
            // [CRÍTICO] 46: SÍ aplica (2). Es el total ITBIS 0% en otra moneda.

            hasMontoImpuestoAdicionalOtraMoneda: false,     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasImpuestosAdicionalesOtraMoneda: false,       // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).

            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 46: 100

            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 46: indicadorFacturacion DEBE SER 3 (ITBIS 0% gravado) en todos los ítems.
            indicadorFacturacionForced: 3,

            // 5-7. Bloque Retención
            hasRetencion: false,                            // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            // 46: NO aplica (0).
            retencionRequired: false,
            hasRetencionIndicador: false,
            hasMontoITBISRetenido: false,
            hasMontoISRRetenido: false,

            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            hasCantidadReferencia: false,                   // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasUnidadReferencia: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            hasTablaSubcantidad: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            subcantidadMax: 0,

            hasGradosAlcohol: false,                        // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).
            hasPrecioUnitarioReferencia: false,             // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 46: NO aplica (0).

            hasFechaElaboracion: true,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            hasFechaVencimientoItem: true,                  // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0

            // 21-24. Bloque Minería
            hasMineria: true,                               // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0  // [CRÍTICO] 46: SÍ aplica (minerales de exportación).
            hasPesoNetoKilogramo: true,                     // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasPesoNetoMineria: true,                       // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasTipoAfiliacion: true,                        // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            hasLiquidacion: true,                           // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0

            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            hasDescuentoMonto: true,                        // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            hasTablaSubDescuento: true,                     // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subDescuentos (JSONB) + builder]
            subDescuentoMax: 12,

            hasRecargoMonto: true,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            hasTablaSubRecargo: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0  // [NUEVO: InvoiceLine.subRecargos (JSONB) + builder]
            subRecargoMax: 12,

            hasTablaImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 46: NO aplica (0).
            impuestoAdicionalItemMax: 0,

            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            // [CRÍTICO] 46: SÍ aplica (2). La exportación suele ser en USD/EUR.
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: true,                                   // 46 usa variante simple
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            maxDescuentos: 20,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: true,                                   // 46 usa variante simple
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 46: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: false,
            isExportacion: true,                            // [CRÍTICO] 46 es Exportación
            isPagoExterior: false,
            itbisTransparente: true,
            itbisObligatorioCero: true,                     // [CRÍTICO] 46 siempre es ITBIS 0% (exportación)
            retencionObligatoria: false,
            // Reglas especiales 46:
            requireAllItemsExport: true,                    // [CRÍTICO] Todos los ítems deben ser indicadorFacturacion = 3
            requiresForeignBuyer: true,                     // [CRÍTICO] El comprador debe ser extranjero
            requiresReceiverPais: true,                     // [CRÍTICO] receiverPais obligatorio
            requiresIdentificadorExtranjeroOrRnc: true,     // [CRÍTICO] Debe tener RNC o IdentificadorExtranjero
            noRetenciones: true,                            // No lleva retenciones
            noImpuestosAdicionales: true,                   // No lleva impuestos adicionales
            transporteExtendido: true,                      // Usa la variante extendida de transporte
            infoAdicionalExtendida: true,                   // Usa la variante extendida de info adicional
        },
    },

    // ============================================================
    // 47 — Comprobante para Pagos al Exterior Electrónico
    // ============================================================
    '47': {
        code: '47',
        name: 'Comprobante para Pagos al Exterior Electrónico',

        // ============================================================
        // A. ENCABEZADO
        // ============================================================
        encabezado: {
            // — Bloque <Encabezado> (contenedor)
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            version: '1.0',                                 // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.1 — <IdDoc>
        // ------------------------------------------------------------
        idDoc: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 1. Versión
            hasVersion: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 2. Tipo e-CF
            hasTipoeCF: true,                               // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 3. e-NCF
            hasENCF: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 4. Fecha Vencimiento Secuencia
            hasFechaVencimientoSecuencia: true,             // 31:1 32:0 33:1 34:0 41:1 43:1 44:1 45:1 46:1 47:1

            // 5. Indicador Nota de Crédito
            hasIndicadorNotaCredito: false,                 // 31:0 32:0 33:0 34:1 41:0 43:0 44:0 45:0 46:0 47:0

            // 6. Indicador Envío Diferido
            hasIndicadorEnvioDiferido: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 7. Indicador Monto Gravado
            hasIndicadorMontoGravado: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 8. Indicador Servicio Todo Incluido
            hasIndicadorServicioTodoIncluido: false,        // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 9. Tipo de Ingresos
            hasTipoIngresos: false,                         // 31:1 32:1 33:1 34:1 41:0 43:0 44:1 45:1 46:1 47:0
            // 47: NO aplica (0).

            // 10. Tipo de Pago
            hasTipoPago: true,                              // 31:1 32:1 33:1 34:1 41:1 43:3 44:1 45:1 46:1 47:3
            // 47: opcional (3). En la práctica siempre va (default 1).
            tipoPagoDefault: 1,                             // [NUEVO]

            // 11. Fecha Límite de Pago
            hasFechaLimitePago: true,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:3  // [NUEVO]
            // 47: opcional (3).

            // 12. Término de Pago
            hasTerminoPago: true,                           // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 12-13. Tabla de Formas de Pago
            hasTablaFormasPago: true,                       // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]
            formasPagoMax: 7,

            // 14. Tipo Cuenta de Pago
            hasTipoCuentaPago: true,                        // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 15. Cuenta de Pago
            hasNumeroCuentaPago: true,                      // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 16. Banco de Pago
            hasBancoPago: true,                             // 31:3 32:3 33:3 34:0 41:3 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 17. Fecha desde
            hasFechaDesde: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 18. Fecha hasta
            hasFechaHasta: true,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:3  // [NUEVO]

            // 19. Total Páginas
            hasTotalPaginas: true,                          // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ------------------------------------------------------------
        // A.2 — <Emisor>
        // ------------------------------------------------------------
        emisor: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 20. RNC Emisor
            hasRNCEmisor: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 21. Razón Social Emisor
            hasRazonSocialEmisor: true,                     // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 22. Nombre Comercial
            hasNombreComercial: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 23. Sucursal
            hasSucursal: true,                              // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.sucursal]

            // 24. Dirección Emisor
            hasDireccionEmisor: true,                       // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 25. Municipio
            hasMunicipio: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.municipio]

            // 26. Provincia
            hasProvincia: true,                             // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.provincia]

            // 27-29. Tabla Teléfono Emisor
            hasTablaTelefonoEmisor: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            telefonoEmisorMax: 3,                           // hasta 3 repeticiones  // [NUEVO: Company.additionalPhones]

            // 28. Correo Emisor
            hasCorreoEmisor: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 29. WebSite
            hasWebSite: true,                               // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Company.website]

            // 30. Actividad Económica
            hasActividadEconomica: true,                    // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            // 31. Código del Vendedor
            hasCodigoVendedor: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 32. Número Factura Interna
            hasNumeroFacturaInterna: true,                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroFacturaInterna]

            // 33. Número Pedido Interno
            hasNumeroPedidoInterno: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.numeroPedidoInterno]

            // 34. Zona de Venta
            hasZonaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 35. Ruta de Venta
            hasRutaVenta: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 36. Información Adicional Emisor
            hasInformacionAdicionalEmisor: true,            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.informacionAdicionalEmisor]

            // 37. Fecha Emisión
            hasFechaEmision: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ------------------------------------------------------------
        // A.3 — <Comprador>
        // ------------------------------------------------------------
        comprador: {
            // 47: obligatoriedad 3 (opcional).
            // Puede ir vacío si no hay datos del comprador extranjero.
            present: true,                                  // 31:1 32:1 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3

            // 38. RNC Comprador
            hasRNCComprador: false,                         // 31:1 32:2 33:2 34:2 41:1 43:0 44:2 45:1 46:2 47:0
            // 47: NO aplica (0). El comprador es extranjero y no tiene RNC dominicano.

            // 39. Identificador Extranjero
            hasIdentificadorExtranjero: true,               // 31:0 32:2 33:2 34:2 41:0 43:0 44:2 45:0 46:2 47:3
            // 47: opcional (3). Es el identificador del comprador extranjero.

            // 40. Razón Social Comprador
            hasRazonSocialComprador: true,                  // 31:1 32:2 33:2 34:2 41:1 43:0 44:1 45:1 46:1 47:3
            // 47: opcional (3).
            razonSocialRequired: false,

            // 41. Contacto Comprador
            hasContactoComprador: false,                    // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 42. Correo Comprador
            hasCorreoComprador: false,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 43. Dirección Comprador
            hasDireccionComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 44. Municipio Comprador
            hasMunicipioComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 45. Provincia Comprador
            hasProvinciaComprador: false,                   // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 46. País Comprador
            hasPaisComprador: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            // 47: NO aplica (0). El país del comprador extranjero va en <Transporte>/<PaisDestino>.

            // 47. Fecha Entrega
            hasFechaEntrega: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 48. Contacto Entrega
            hasContactoEntrega: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 49. Dirección Entrega
            hasDireccionEntrega: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 50. Teléfono Adicional
            hasTelefonoAdicional: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 51. Fecha Orden Compra
            hasFechaOrdenCompra: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 52. Número Orden Compra
            hasNumeroOrdenCompra: false,                    // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 53. Código Interno Comprador
            hasCodigoInternoComprador: false,               // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 54. Responsable Pago
            hasResponsablePago: false,                      // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 55. Información Adicional Comprador
            hasInformacionAdicionalComprador: false,        // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.4 — <InformacionesAdicionales>
        // ------------------------------------------------------------
        informacionesAdicionales: {
            present: false,                                 // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0). El bloque completo no se emite.
            extended: false,

            // Todos los campos has* son false porque el bloque no aplica.
            hasFechaEmbarque: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroEmbarque: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroContenedor: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroReferencia: false,                     // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNombrePuertoEmbarque: false,                 // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasCondicionesEntrega: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalFob: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasSeguro: false,                               // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasFlete: false,                                // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasOtrosGastos: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasTotalCif: false,                             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasRegimenAduanero: false,                      // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoSalida: false,                   // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombrePuertoDesembarque: false,              // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPesoBruto: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPesoNeto: false,                             // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoBruto: false,                      // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadPesoNeto: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasCantidadBulto: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadBulto: false,                          // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasVolumenBulto: false,                         // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasUnidadVolumen: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.5 — <Transporte> (REDUCIDO para 47)
        // ------------------------------------------------------------
        transporte: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            extended: false,
            reduced: true,                                  // [CRÍTICO] 47 usa la variante reducida. Solo lleva <PaisDestino>.

            // Todos los campos has* son false excepto <PaisDestino>.
            hasViaTransporte: false,                        // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisOrigen: false,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasDireccionDestino: false,                     // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasPaisDestino: true,                           // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:3  // [CRÍTICO] 47: único campo del transporte reducido.
            hasRNCCompaniaTransportista: false,             // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNombreCompaniaTransportista: false,          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasNumeroViaje: false,                          // 31:0 32:0 33:0 34:0 41:0 43:0 44:0 45:0 46:3 47:0
            hasConductor: false,                            // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasDocumentoTransporte: false,                  // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasFicha: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasPlaca: false,                                // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasRutaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasZonaTransporte: false,                       // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
            hasNumeroAlbaran: false,                        // 31:3 32:3 33:3 34:3 41:0 43:0 44:3 45:3 46:3 47:0
        },

        // ------------------------------------------------------------
        // A.6 — <Totales>
        // ------------------------------------------------------------
        totales: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 92. Monto Gravado Total
            hasMontoGravadoTotal: false,                    // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0). Solo exento.

            // 93. Monto Gravado ITBIS Tasa 1
            hasMontoGravadoI1: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 94. Monto Gravado ITBIS Tasa 2
            hasMontoGravadoI2: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 95. Monto Gravado ITBIS Tasa 3
            hasMontoGravadoI3: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 96. Monto Exento
            hasMontoExento: true,                           // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 47: SIEMPRE lleva MontoExento. Es el único monto que lleva.

            // 97. ITBIS Tasa 1
            hasITBIS1: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 98. ITBIS Tasa 2
            hasITBIS2: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 99. ITBIS Tasa 3
            hasITBIS3: false,                               // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 100. Total ITBIS
            hasTotalITBIS: false,                           // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 101. Total ITBIS Tasa 1
            hasTotalITBIS1: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 102. Total ITBIS Tasa 2
            hasTotalITBIS2: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 103. Total ITBIS Tasa 3
            hasTotalITBIS3: false,                          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 104. Monto Impuesto Adicional
            hasMontoImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).

            // 105-109. Impuestos Adicionales (tabla)
            hasImpuestosAdicionales: false,                 // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).
            impuestosAdicionalesMax: 0,

            // 110. Monto Total
            hasMontoTotal: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 47: SIEMPRE lleva MontoTotal.

            // 111. Monto No Facturable
            hasMontoNoFacturable: false,                    // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 112. Monto Período
            hasMontoPeriodo: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoPeriodo + builder]

            // 113. Saldo Anterior
            hasSaldoAnterior: true,                         // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.saldoAnterior + builder]

            // 114. Monto Avance de Pago
            hasMontoAvancePago: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.montoAvancePago + builder]

            // 115. Valor a Pagar
            hasValorPagar: true,                            // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3  // [NUEVO: Invoice.valorPagar + builder]

            // 116. Total ITBIS Retenido
            hasTotalITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 47: NO aplica (0). Solo lleva TotalISRRetencion.

            // 117. Total ISR Retención
            hasTotalISRRetencion: true,                     // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:2  // [NUEVO: builder]
            // [CRÍTICO] 47: SÍ aplica (2). Es el único total de retención que lleva.

            // 118. Total ITBIS Percepción
            hasTotalITBISPercepcion: false,                 // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 47: NO aplica (0).

            // 119. Total ISR Percepción
            hasTotalISRPercepcion: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 47: NO aplica (0).
        },

        // ------------------------------------------------------------
        // A.7 — <OtraMoneda> (Encabezado)
        // ------------------------------------------------------------
        otraMoneda: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasTipoMoneda: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoMoneda]
            // [CRÍTICO] 47: SIEMPRE debería ir en USD/EUR por ser pago al exterior.

            hasTipoCambio: true,                            // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO: Invoice.tipoCambio]

            hasMontoGravadoTotalOtraMoneda: false,          // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).
            hasMontoGravado1OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasMontoGravado2OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasMontoGravado3OtraMoneda: false,              // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            hasMontoExentoOtraMoneda: true,                 // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:0 47:2
            // [CRÍTICO] 47: SIEMPRE lleva MontoExentoOtraMoneda si hay moneda extranjera.

            hasTotalITBISOtraMoneda: false,                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).
            hasTotalITBIS1OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasTotalITBIS2OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasTotalITBIS3OtraMoneda: false,                // 31:2 32:2 33:2 34:2 41:2 43:0 44:0 45:2 46:2 47:0
            // 47: NO aplica (0).

            hasMontoImpuestoAdicionalOtraMoneda: false,     // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasImpuestosAdicionalesOtraMoneda: false,       // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).

            hasMontoTotalOtraMoneda: true,                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
        },

        // ============================================================
        // B. DETALLE — <DetallesItem> / <Item>
        // ============================================================
        items: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            maxItems: 100,                                  // 47: 100

            hasNumeroLinea: true,                           // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            hasTablaCodigosItem: true,                      // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            codigosItemMax: 5,                              // [NUEVO: InvoiceLine.additionalCodes (JSONB)]

            hasIndicadorFacturacion: true,                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 47: indicadorFacturacion DEBE SER 4 (Exento) en todos los ítems.
            indicadorFacturacionForced: 4,

            // 5-7. Bloque Retención
            hasRetencion: true,                             // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionRequired: true,                        // [CRÍTICO] 47: retención obligatoria por línea (1)
            hasRetencionIndicador: true,                    // 31:2 32:0 33:2 34:2 41:1 43:0 44:0 45:0 46:0 47:1
            retencionFields: ['IndicadorAgenteRetencionoPercepcion', 'MontoISRRetenido'],
            hasMontoITBISRetenido: false,                   // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:0
            // 47: NO aplica (0). Solo lleva MontoISRRetenido.
            hasMontoISRRetenido: true,                      // 31:2 32:0 33:2 34:2 41:2 43:0 44:0 45:0 46:0 47:1
            // [CRÍTICO] 47: SÍ aplica (1).

            hasNombreItem: true,                            // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasIndicadorBienoServicio: true,                // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            // [CRÍTICO] 47: indicadorBienoServicio DEBE SER 2 (Servicio) en todos los ítems.
            indicadorBienoServicioForced: 2,
            hasDescripcionItem: true,                       // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasCantidadItem: true,                          // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
            hasUnidadMedida: true,                          // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3

            hasCantidadReferencia: false,                   // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasUnidadReferencia: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            hasTablaSubcantidad: false,                     // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            subcantidadMax: 0,

            hasGradosAlcohol: false,                        // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).
            hasPrecioUnitarioReferencia: false,             // 31:2 32:2 33:2 34:2 41:0 43:0 44:0 45:2 46:0 47:0
            // 47: NO aplica (0).

            hasFechaElaboracion: false,                     // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).
            hasFechaVencimientoItem: false,                 // 31:3 32:3 33:3 34:3 41:3 43:0 44:3 45:3 46:3 47:0
            // 47: NO aplica (0).

            // 21-24. Bloque Minería
            hasMineria: false,                              // 31:0 32:2 33:2 34:2 41:0 43:0 44:0 45:0 46:2 47:0
            // 47: NO aplica (0).
            hasPesoNetoKilogramo: false,
            hasPesoNetoMineria: false,
            hasTipoAfiliacion: false,
            hasLiquidacion: false,

            hasPrecioUnitarioItem: true,                    // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1

            // 26. Monto Descuento
            hasDescuentoMonto: false,                       // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 27-29. Tabla Subdescuento
            hasTablaSubDescuento: false,                    // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).
            subDescuentoMax: 0,

            // 30. Monto Recargo
            hasRecargoMonto: false,                         // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).

            // 31-33. Tabla Subrecargo
            hasTablaSubRecargo: false,                      // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0).
            subRecargoMax: 0,

            // 34. Tabla Impuesto Adicional (por ítem)
            hasTablaImpuestoAdicional: false,               // 31:2 32:2 33:2 34:2 41:0 43:0 44:2 45:2 46:0 47:0
            // 47: NO aplica (0).
            impuestoAdicionalItemMax: 0,

            // 35-38. Bloque OtraMonedaDetalle
            hasOtraMonedaDetalle: true,                     // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2  // [NUEVO]
            hasPrecioOtraMoneda: true,                      // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            hasDescuentoOtraMoneda: true,                   // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasRecargoOtraMoneda: true,                     // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            hasMontoItemOtraMoneda: true,                   // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2

            hasMontoItem: true,                             // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // C. SUBTOTALES INFORMATIVOS — <Subtotales>
        // ============================================================
        subtotales: {
            present: true,                                  // 31:3 32:3 33:3 34:3 41:3 43:3 44:3 45:3 46:3 47:3
            maxSubtotales: 20,
            simple: true,                                   // 47 usa variante simple
        },

        // ============================================================
        // D. DESCUENTOS O RECARGOS — <DescuentosORecargos>
        // ============================================================
        descuentosORecargos: {
            present: false,                                 // 31:2 32:2 33:2 34:2 41:2 43:0 44:2 45:2 46:2 47:0
            // 47: NO aplica (0). El bloque completo no se emite.
            maxDescuentos: 0,
        },

        // ============================================================
        // E. PAGINACIÓN — <Paginacion>
        // ============================================================
        paginacion: {
            present: true,                                  // 31:2 32:2 33:2 34:2 41:2 43:2 44:2 45:2 46:2 47:2
            requiresMultipage: true,
            simple: true,                                   // 47 usa variante simple
        },

        // ============================================================
        // F. INFORMACIÓN DE REFERENCIA — <InformacionReferencia>
        // ============================================================
        informacionReferencia: {
            present: true,                                  // 31:2 32:2 33:1 34:1 41:2 43:2 44:2 45:2 46:2 47:2
            required: false,                                // 47: condicional (2)
            hasRazonModificacion: false,                    // 31:0 32:0 33:3 34:3 41:0 43:0 44:0 45:0 46:0 47:0
        },

        // ============================================================
        // G. FECHA Y HORA DE LA FIRMA — <FechaHoraFirma>
        // ============================================================
        fechaHoraFirma: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // H. FIRMA DIGITAL — <Signature>
        // ============================================================
        firmaDigital: {
            present: true,                                  // 31:1 32:1 33:1 34:1 41:1 43:1 44:1 45:1 46:1 47:1
        },

        // ============================================================
        // REGLAS DE NEGOCIO
        // ============================================================
        taxRules: {
            isNota: false,
            isAutofactura: false,
            isExportacion: false,
            isPagoExterior: true,                           // [CRÍTICO] 47 es Pago al Exterior
            itbisTransparente: false,                       // [CRÍTICO] 47 no maneja ITBIS transparente
            itbisObligatorioCero: true,                     // [CRÍTICO] 47 siempre es exento (no sujeto a ITBIS)
            retencionObligatoria: true,                     // [CRÍTICO] 47 siempre lleva retención de ISR
            // Reglas especiales 47:
            requireAllItemsExempt: true,                    // [CRÍTICO] Todos los ítems deben ser indicadorFacturacion = 4
            requireAllItemsService: true,                   // [CRÍTICO] Todos los ítems deben ser indicadorBienoServicio = 2
            requiresISRRetencion: true,                     // [CRÍTICO] Debe llevar retención de ISR (TotalISRRetencion)
            noITBISRetenido: true,                          // [CRÍTICO] NO lleva retención de ITBIS
            noImpuestosAdicionales: true,                   // No lleva impuestos adicionales
            transporteReducido: true,                       // Usa la variante reducida de transporte (solo PaisDestino)
            noInfoAdicional: true,                          // No lleva info adicional
            noDescuentosGlobales: true,                     // No lleva descuentos/recargos globales
            isPagoExteriorPayment: true,                    // Es pago al exterior (servicios prestados por no residentes)
        },
    },
};

// ============================================================
// HELPERS
// ============================================================

function getTypeProfile(type) {
    const profile = TYPE_PROFILES[String(type)];
    if (!profile) {
        throw new Error(`No profile defined for e-CF type ${type}`);
    }
    return profile;
}

function isValidType(type) {
    return Object.prototype.hasOwnProperty.call(TYPE_PROFILES, String(type));
}

function getAllTypes() {
    return Object.keys(TYPE_PROFILES);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    TYPE_PROFILES,
    getTypeProfile,
    isValidType,
    getAllTypes,
};