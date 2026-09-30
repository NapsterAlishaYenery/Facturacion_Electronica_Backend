// src/modules/invoices/ecf/type-profiles.js
//
// Perfiles de los 10 tipos de e-CF DGII.
// Cada perfil describe QUÉ bloques existen en el XSD de ese tipo,
// sus cardinalidades, y reglas de validación.
//
// Fuente: XSD oficiales v1.0 provistos por la DGII.
//
// IMPORTANTE: Los perfiles describen la ESTRUCTURA declarada en el XSD.
// Las reglas fiscales de negocio (ITBIS 0% en 46, retención obligatoria
// en 41/47, etc.) se describen en `taxRules` y las aplica el builder.

'use strict';

// ============================================================
// PERFILES
// ============================================================

const TYPE_PROFILES = {

  // ----------------------------------------------------------
  // 31 - Factura de Crédito Fiscal Electrónica
  // ----------------------------------------------------------
  '31': {
    code: '31',
    name: 'Factura de Crédito Fiscal Electrónica',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: true,
      razonSocialRequired: true,
      hasIdentificadorExtranjero: false,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: true,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: true,
      retencionRequired: false,
      hasMineria: false,
      hasGradosAlcohol: true,
      hasPrecioUnitarioReferencia: true,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

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

  // ----------------------------------------------------------
  // 32 - Factura de Consumo Electrónica
  // ----------------------------------------------------------
  '32': {
    code: '32',
    name: 'Factura de Consumo Electrónica',

    idDoc: {
      hasFechaVencimientoSecuencia: false,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: false,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: false,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: false,
      hasMineria: true,
      hasGradosAlcohol: true,
      hasPrecioUnitarioReferencia: true,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

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

  // ----------------------------------------------------------
  // 33 - Nota de Débito Electrónica
  // ----------------------------------------------------------
  '33': {
    code: '33',
    name: 'Nota de Débito Electrónica',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: false,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: true,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: true,
      retencionRequired: false,
      hasMineria: true,
      hasGradosAlcohol: true,
      hasPrecioUnitarioReferencia: true,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: true,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: true,
      isAutofactura: false,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: true,
      itbisObligatorioCero: false,
      retencionObligatoria: false,
    },
  },

  // ----------------------------------------------------------
  // 34 - Nota de Crédito Electrónica
  // ----------------------------------------------------------
  '34': {
    code: '34',
    name: 'Nota de Crédito Electrónica',

    idDoc: {
      hasFechaVencimientoSecuencia: false,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: false,
      hasTablaFormasPago: false,
      hasTipoCuentaPago: false,
      hasNumeroCuentaPago: false,
      hasBancoPago: false,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
      hasIndicadorNotaCredito: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: false,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: true,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: true,
      retencionRequired: false,
      hasMineria: true,
      hasGradosAlcohol: true,
      hasPrecioUnitarioReferencia: true,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: true,
      hasRazonModificacion: true,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: true,
      isAutofactura: false,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: true,
      itbisObligatorioCero: false,
      retencionObligatoria: false,
      indicadorNotaCreditoRequired: true,
    },
  },

  // ----------------------------------------------------------
  // 41 - Compras Electrónico
  // ----------------------------------------------------------
  '41': {
    code: '41',
    name: 'Comprobante de Compras Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: false,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: false,
      hasTipoIngresos: false,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: false,
      hasFechaHasta: false,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: true,
      razonSocialRequired: true,
      hasIdentificadorExtranjero: false,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: false,
      hasZonaVenta: false,
      hasRutaVenta: false,
    },

    transporte: {
      present: false,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: false,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: false,
      hasImpuestosAdicionales: false,
      hasRetenciones: true,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: true,
      retencionRequired: true,
      hasMineria: false,
      hasGradosAlcohol: false,
      hasPrecioUnitarioReferencia: false,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: false,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: false,

    taxRules: {
      isNota: false,
      isAutofactura: true,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: true,
      itbisObligatorioCero: false,
      retencionObligatoria: true,
    },
  },

  // ----------------------------------------------------------
  // 43 - Gastos Menores Electrónico
  // ----------------------------------------------------------
  '43': {
    code: '43',
    name: 'Comprobante de Gastos Menores Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: false,
      hasIndicadorMontoGravado: false,
      hasIndicadorServicioTodoIncluido: false,
      hasTipoIngresos: false,
      hasTipoPago: true,
      hasFechaLimitePago: false,
      hasTerminoPago: false,
      hasTablaFormasPago: false,
      hasTipoCuentaPago: false,
      hasNumeroCuentaPago: false,
      hasBancoPago: false,
      hasFechaDesde: false,
      hasFechaHasta: false,
      hasTotalPaginas: true,
    },

    comprador: {
      present: false,
    },

    emisor: {
      hasCodigoVendedor: false,
      hasZonaVenta: false,
      hasRutaVenta: false,
    },

    transporte: {
      present: false,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: false,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: false,
      hasMontoGravadoI1: false,
      hasMontoGravadoI2: false,
      hasMontoGravadoI3: false,
      hasMontoExento: true,
      hasITBIS1: false,
      hasITBIS2: false,
      hasITBIS3: false,
      hasTotalITBIS: false,
      hasTotalITBIS1: false,
      hasTotalITBIS2: false,
      hasTotalITBIS3: false,
      hasMontoImpuestoAdicional: false,
      hasImpuestosAdicionales: false,
      hasRetenciones: false,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: false,
      hasMineria: false,
      hasGradosAlcohol: false,
      hasPrecioUnitarioReferencia: false,
      hasDescuento: false,
      hasTablaSubDescuento: false,
      hasRecargo: false,
      hasTablaSubRecargo: false,
      hasTablaImpuestoAdicional: false,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true, simple: true },
    descuentosORecargos: { present: false },
    paginacion: { present: true, simple: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: false,

    taxRules: {
      isNota: false,
      isAutofactura: true,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: false,
      itbisObligatorioCero: true,
      retencionObligatoria: false,
      maxMontoTotal: 25000,
    },
  },

  // ----------------------------------------------------------
  // 44 - Regímenes Especiales Electrónico
  // ----------------------------------------------------------
  '44': {
    code: '44',
    name: 'Comprobante de Regímenes Especiales Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: false,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: true,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: false,
      hasMontoGravadoI1: false,
      hasMontoGravadoI2: false,
      hasMontoGravadoI3: false,
      hasMontoExento: true,
      hasITBIS1: false,
      hasITBIS2: false,
      hasITBIS3: false,
      hasTotalITBIS: false,
      hasTotalITBIS1: false,
      hasTotalITBIS2: false,
      hasTotalITBIS3: false,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: false,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: false,
      hasMineria: false,
      hasGradosAlcohol: false,
      hasPrecioUnitarioReferencia: false,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: false,
      isAutofactura: true,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: false,
      itbisObligatorioCero: true,
      retencionObligatoria: false,
    },
  },

  // ----------------------------------------------------------
  // 45 - Gubernamental Electrónico
  // ----------------------------------------------------------
  '45': {
    code: '45',
    name: 'Comprobante Gubernamental Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: true,
      hasIndicadorServicioTodoIncluido: true,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: true,
      razonSocialRequired: true,
      hasIdentificadorExtranjero: false,
      hasPaisComprador: false,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: false,
    },

    informacionesAdicionales: {
      present: true,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: true,
      hasMontoGravadoI2: true,
      hasMontoGravadoI3: true,
      hasMontoExento: true,
      hasITBIS1: true,
      hasITBIS2: true,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: true,
      hasTotalITBIS2: true,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: true,
      hasImpuestosAdicionales: true,
      hasRetenciones: false,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: false,
      hasMineria: false,
      hasGradosAlcohol: true,
      hasPrecioUnitarioReferencia: true,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: true,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: false,
      isAutofactura: true,
      isExportacion: false,
      isPagoExterior: false,
      itbisTransparente: true,
      itbisObligatorioCero: false,
      retencionObligatoria: false,
      isGubernamental: true,
    },
  },

  // ----------------------------------------------------------
  // 46 - Comprobante de Exportaciones Electrónico
  // ----------------------------------------------------------
  '46': {
    code: '46',
    name: 'Comprobante de Exportaciones Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: true,
      hasIndicadorMontoGravado: false,
      hasIndicadorServicioTodoIncluido: false,
      hasTipoIngresos: true,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: true,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: true,
    },

    emisor: {
      hasCodigoVendedor: true,
      hasZonaVenta: true,
      hasRutaVenta: true,
    },

    transporte: {
      present: true,
      extended: true,
      reduced: false,
      fields: [
        'ViaTransporte',
        'PaisOrigen',
        'DireccionDestino',
        'PaisDestino',
        'RNCIdentificacionCompaniaTransportista',
        'NombreCompaniaTransportista',
        'NumeroViaje',
        'Conductor',
        'DocumentoTransporte',
        'Ficha',
        'Placa',
        'RutaTransporte',
        'ZonaTransporte',
        'NumeroAlbaran',
      ],
    },

    informacionesAdicionales: {
      present: true,
      extended: true,
      fields: [
        'FechaEmbarque',
        'NumeroEmbarque',
        'NumeroContenedor',
        'NumeroReferencia',
        'NombrePuertoEmbarque',
        'CondicionesEntrega',
        'TotalFob',
        'Seguro',
        'Flete',
        'OtrosGastos',
        'TotalCif',
        'RegimenAduanero',
        'NombrePuertoSalida',
        'NombrePuertoDesembarque',
        'PesoBruto',
        'PesoNeto',
        'UnidadPesoBruto',
        'UnidadPesoNeto',
        'CantidadBulto',
        'UnidadBulto',
        'VolumenBulto',
        'UnidadVolumen',
      ],
    },

    totales: {
      hasMontoGravadoTotal: true,
      hasMontoGravadoI1: false,
      hasMontoGravadoI2: false,
      hasMontoGravadoI3: true,
      hasMontoExento: false,
      hasITBIS1: false,
      hasITBIS2: false,
      hasITBIS3: true,
      hasTotalITBIS: true,
      hasTotalITBIS1: false,
      hasTotalITBIS2: false,
      hasTotalITBIS3: true,
      hasMontoImpuestoAdicional: false,
      hasImpuestosAdicionales: false,
      hasRetenciones: false,
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: false,
      hasMineria: true,
      hasGradosAlcohol: false,
      hasPrecioUnitarioReferencia: false,
      hasDescuento: true,
      hasTablaSubDescuento: true,
      hasRecargo: true,
      hasTablaSubRecargo: true,
      hasTablaImpuestoAdicional: false,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true, simple: true },
    descuentosORecargos: { present: true },
    paginacion: { present: true, simple: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: false,
      isAutofactura: false,
      isExportacion: true,
      isPagoExterior: false,
      itbisTransparente: true,
      itbisObligatorioCero: true,
      retencionObligatoria: false,
    },
  },

  // ----------------------------------------------------------
  // 47 - Comprobante para Pagos al Exterior Electrónico
  // ----------------------------------------------------------
  '47': {
    code: '47',
    name: 'Comprobante para Pagos al Exterior Electrónico',

    idDoc: {
      hasFechaVencimientoSecuencia: true,
      hasIndicadorEnvioDiferido: false,
      hasIndicadorMontoGravado: false,
      hasIndicadorServicioTodoIncluido: false,
      hasTipoIngresos: false,
      hasTipoPago: true,
      hasFechaLimitePago: true,
      hasTerminoPago: true,
      hasTablaFormasPago: true,
      hasTipoCuentaPago: true,
      hasNumeroCuentaPago: true,
      hasBancoPago: true,
      hasFechaDesde: true,
      hasFechaHasta: true,
      hasTotalPaginas: true,
    },

    comprador: {
      present: true,
      rncRequired: false,
      razonSocialRequired: false,
      hasIdentificadorExtranjero: true,
      hasPaisComprador: false,
    },

    transporte: {
      present: true,
      extended: false,
      reduced: true,
      fields: ['PaisDestino'],
    },

    emisor: {
      hasCodigoVendedor: false,
      hasZonaVenta: false,
      hasRutaVenta: false,
    },

    informacionesAdicionales: {
      present: false,
      extended: false,
    },

    totales: {
      hasMontoGravadoTotal: false,
      hasMontoGravadoI1: false,
      hasMontoGravadoI2: false,
      hasMontoGravadoI3: false,
      hasMontoExento: true,
      hasITBIS1: false,
      hasITBIS2: false,
      hasITBIS3: false,
      hasTotalITBIS: false,
      hasTotalITBIS1: false,
      hasTotalITBIS2: false,
      hasTotalITBIS3: false,
      hasMontoImpuestoAdicional: false,
      hasImpuestosAdicionales: false,
      hasRetenciones: true,
      retencionesFields: ['TotalISRRetencion'],
    },

    items: {
      hasTablaCodigosItem: true,
      hasRetencion: true,
      retencionRequired: true,
      retencionFields: ['IndicadorAgenteRetencionoPercepcion', 'MontoISRRetenido'],
      hasMineria: false,
      hasGradosAlcohol: false,
      hasPrecioUnitarioReferencia: false,
      hasDescuento: false,
      hasTablaSubDescuento: false,
      hasRecargo: false,
      hasTablaSubRecargo: false,
      hasTablaImpuestoAdicional: false,
      hasOtraMonedaDetalle: true,
    },

    subtotales: { present: true, simple: true },
    descuentosORecargos: { present: false },
    paginacion: { present: true, simple: true },
    informacionReferencia: {
      present: true,
      required: false,
    },

    hasTransporteBlock: true,

    taxRules: {
      isNota: false,
      isAutofactura: false,
      isExportacion: false,
      isPagoExterior: true,
      itbisTransparente: false,
      itbisObligatorioCero: true,
      retencionObligatoria: true,
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