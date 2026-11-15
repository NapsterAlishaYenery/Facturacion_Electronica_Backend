// ============================================================
// update.schema.js
// Joi.object({...}) de updateInvoiceSchema SIN .min(1)/.messages()/.custom().
// La cadena .min(1).messages().custom().messages() se aplica en update.rules.js.
// ============================================================

const Joi = require('joi');

const { itemSchema } = require('../schemas/item.schema');
const { subtotalSchema } = require('../schemas/subtotal.schema');
const { descuentoORecargoSchema } = require('../schemas/descuentoRecargo.schema');
const { informacionesAdicionalesSchema } = require('../schemas/informacionesAdicionales.schema');
const { idDocExtrasSchema } = require('../schemas/idDocExtras.schema');
const { emisorExtrasSchema } = require('../schemas/emisorExtras.schema');
const { compradorExtrasSchema } = require('../schemas/compradorExtras.schema');
const { totalesExtrasSchema } = require('../schemas/totalesExtras.schema');
const { otraMonedaSchema } = require('../schemas/otraMoneda.schema');

const updateInvoiceSchemaBase = Joi.object({
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver RNC cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver name cannot exceed 200 characters'
        }),
    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),

    // DT32 — Subtotales
    subtotales: Joi.array()
        .items(subtotalSchema)
        .max(20)
        .optional()
        .allow(null),

    // DT33 — Descuentos o Recargos globales
    descuentosORecargos: Joi.array()
        .items(descuentoORecargoSchema)
        .max(20)
        .optional()
        .allow(null)
        .messages({
            'array.max': 'No puede haber más de 20 descuentos o recargos'
        }),

    items: Joi.array()
        .items(itemSchema)
        .min(1)
        .max(100)
        .optional()
        .messages({
            'array.min': 'If items are provided, at least one is required',
            'array.max': 'Invoice cannot have more than 100 items'
        }),

    // DT35 — campos editables
    modificationCode: Joi.number().integer().optional().allow(null)
        .messages({
            'number.base': 'CodigoModificacion must be a number',
            'number.integer': 'CodigoModificacion must be an integer'
        }),
    modificationReason: Joi.string().max(90).optional().allow(null, '')
        .messages({
            'string.max': 'RazonModificacion cannot exceed 90 characters'
        }),

    // ============================================================
    // DT30 — IdDoc extendido
    // ============================================================
    indicadorEnvioDiferido: idDocExtrasSchema.extract('indicadorEnvioDiferido'),
    indicadorMontoGravado: idDocExtrasSchema.extract('indicadorMontoGravado'),
    indicadorServicioTodoIncluido: idDocExtrasSchema.extract('indicadorServicioTodoIncluido'),
    tipoIngresos: idDocExtrasSchema.extract('tipoIngresos'),
    tipoPago: idDocExtrasSchema.extract('tipoPago'),
    fechaLimitePago: idDocExtrasSchema.extract('fechaLimitePago'),
    terminoPago: idDocExtrasSchema.extract('terminoPago'),
    formasPago: idDocExtrasSchema.extract('formasPago'),
    tipoCuentaPago: idDocExtrasSchema.extract('tipoCuentaPago'),
    numeroCuentaPago: idDocExtrasSchema.extract('numeroCuentaPago'),
    bancoPago: idDocExtrasSchema.extract('bancoPago'),
    fechaDesde: idDocExtrasSchema.extract('fechaDesde'),
    fechaHasta: idDocExtrasSchema.extract('fechaHasta'),
    totalPaginas: idDocExtrasSchema.extract('totalPaginas'),

    // DT30 — Emisor extendido
    codigoVendedor: emisorExtrasSchema.extract('codigoVendedor'),
    numeroFacturaInterna: emisorExtrasSchema.extract('numeroFacturaInterna'),
    numeroPedidoInterno: emisorExtrasSchema.extract('numeroPedidoInterno'),
    zonaVenta: emisorExtrasSchema.extract('zonaVenta'),
    rutaVenta: emisorExtrasSchema.extract('rutaVenta'),
    informacionAdicionalEmisor: emisorExtrasSchema.extract('informacionAdicionalEmisor'),

    // DT30 — Comprador extendido
    contactoComprador: compradorExtrasSchema.extract('contactoComprador'),
    correoComprador: compradorExtrasSchema.extract('correoComprador'),
    direccionComprador: compradorExtrasSchema.extract('direccionComprador'),
    municipioComprador: compradorExtrasSchema.extract('municipioComprador'),
    provinciaComprador: compradorExtrasSchema.extract('provinciaComprador'),
    fechaEntrega: compradorExtrasSchema.extract('fechaEntrega'),
    contactoEntrega: compradorExtrasSchema.extract('contactoEntrega'),
    direccionEntrega: compradorExtrasSchema.extract('direccionEntrega'),
    telefonoAdicional: compradorExtrasSchema.extract('telefonoAdicional'),
    fechaOrdenCompra: compradorExtrasSchema.extract('fechaOrdenCompra'),
    numeroOrdenCompra: compradorExtrasSchema.extract('numeroOrdenCompra'),
    codigoInternoComprador: compradorExtrasSchema.extract('codigoInternoComprador'),
    responsablePago: compradorExtrasSchema.extract('responsablePago'),
    informacionAdicionalComprador: compradorExtrasSchema.extract('informacionAdicionalComprador'),

    // DT30 — Totales extendido
    montoImpuestoAdicional: totalesExtrasSchema.extract('montoImpuestoAdicional'),
    impuestosAdicionales: totalesExtrasSchema.extract('impuestosAdicionales'),
    montoNoFacturable: totalesExtrasSchema.extract('montoNoFacturable'),
    montoPeriodo: totalesExtrasSchema.extract('montoPeriodo'),
    saldoAnterior: totalesExtrasSchema.extract('saldoAnterior'),
    montoAvancePago: totalesExtrasSchema.extract('montoAvancePago'),
    valorPagar: totalesExtrasSchema.extract('valorPagar'),
    totalItbisPercepcion: totalesExtrasSchema.extract('totalItbisPercepcion'),
    totalIsrPercepcion: totalesExtrasSchema.extract('totalIsrPercepcion'),

    // DT30 — OtraMoneda (solo tipoMoneda/tipoCambio; el resto forbidden abajo)
    tipoMoneda: otraMonedaSchema.extract('tipoMoneda'),
    tipoCambio: otraMonedaSchema.extract('tipoCambio'),
    montoGravadoTotalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravadoTotalOtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoGravado1OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado1OtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoGravado2OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado2OtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoGravado3OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado3OtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoExentoOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoExentoOtraMoneda se calcula automáticamente. No lo envíes.' }),
    totalItbisOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbisOtraMoneda se calcula automáticamente. No lo envíes.' }),
    totalItbis1OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis1OtraMoneda se calcula automáticamente. No lo envíes.' }),
    totalItbis2OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis2OtraMoneda se calcula automáticamente. No lo envíes.' }),
    totalItbis3OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis3OtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoImpuestoAdicionalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoImpuestoAdicionalOtraMoneda se calcula automáticamente. No lo envíes.' }),
    impuestosAdicionalesOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'impuestosAdicionalesOtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoTotalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoTotalOtraMoneda se calcula automáticamente. No lo envíes.' }),

    // Campos NO editables nunca
    modifiedNcf: Joi.forbidden().messages({
        'any.unknown': 'NCFModificado cannot be changed after creation (it identifies the original invoice)'
    }),
    modifiedNcfIssuerRnc: Joi.forbidden().messages({
        'any.unknown': 'RNCOtroContribuyente cannot be changed after creation (it identifies the original issuer)'
    }),
    modifiedNcfDate: Joi.forbidden().messages({
        'any.unknown': 'FechaNCFModificado cannot be changed after creation (it identifies the original invoice)'
    }),
    indicadorNotaCredito: Joi.forbidden().messages({
        'any.unknown': 'IndicadorNotaCredito cannot be changed after creation (it depends on the original invoice date)'
    }),

    // Tipo / extranjero / transporte / derivados
    type: Joi.forbidden(),
    receiverIdentificadorExtranjero: Joi.forbidden(),
    receiverPais: Joi.forbidden(),
    transporte: Joi.forbidden(),
    informacionesAdicionales: informacionesAdicionalesSchema,
    exemptAmount: Joi.forbidden(),
    itbis3Base: Joi.forbidden(),
    itbis3Amount: Joi.forbidden(),
    totalItbisRetenido: Joi.forbidden(),
    totalIsrRetencion: Joi.forbidden()
});

module.exports = { updateInvoiceSchemaBase };