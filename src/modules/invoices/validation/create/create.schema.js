// ============================================================
// create.schema.js
// Joi.object({...}) de createInvoiceSchema SIN .custom().
// El .custom() se inyecta en create.rules.js.
// ============================================================

const Joi = require('joi');

const { itemSchema } = require('../schemas/item.schema');
const { subtotalSchema } = require('../schemas/subtotal.schema');
const { descuentoORecargoSchema } = require('../schemas/descuentoRecargo.schema');
const { transporteSchema } = require('../schemas/transporte.schema');
const { informacionesAdicionalesSchema } = require('../schemas/informacionesAdicionales.schema');
const { idDocExtrasSchema } = require('../schemas/idDocExtras.schema');
const { emisorExtrasSchema } = require('../schemas/emisorExtras.schema');
const { compradorExtrasSchema } = require('../schemas/compradorExtras.schema');
const { totalesExtrasSchema } = require('../schemas/totalesExtras.schema');
const { otraMonedaSchema } = require('../schemas/otraMoneda.schema');

const createInvoiceSchemaBase = Joi.object({
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .required()
        .messages({
            'any.required': 'Invoice type is required',
            'any.only': 'Type must be a valid e-CF type'
        }),

    // --- Comprador nacional ---
    receiverRnc: Joi.string().max(15).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver RNC cannot exceed 15 characters'
        }),
    receiverName: Joi.string().max(200).optional().allow(null, '')
        .messages({
            'string.max': 'Receiver name cannot exceed 200 characters'
        }),

    // --- Comprador extranjero (46, 47) ---
    receiverIdentificadorExtranjero: Joi.when('type', {
        is: Joi.valid('46', '47'),
        then: Joi.string().max(20).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),
    receiverPais: Joi.when('type', {
        is: '46',
        then: Joi.string().max(60).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),

    issuedAt: Joi.date().iso().optional()
        .messages({
            'date.format': 'issuedAt must be a valid ISO date'
        }),

    // --- Notas de Débito/Crédito (33/34) ---
    modifiedNcf: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().min(11).max(19).required()
            .messages({
                'any.required': 'NCFModificado is required for Notas (33/34)',
                'string.min': 'NCFModificado must be at least 11 characters',
                'string.max': 'NCFModificado cannot exceed 19 characters'
            }),
        otherwise: Joi.string().min(11).max(19).optional().allow(null, '')
            .messages({
                'string.min': 'NCFModificado must be at least 11 characters',
                'string.max': 'NCFModificado cannot exceed 19 characters'
            })
    }),

    modifiedNcfIssuerRnc: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().pattern(/^\d{9}$|^\d{11}$/).optional().allow(null, '')
            .messages({
                'string.pattern.base': 'RNCOtroContribuyente must be 9 or 11 digits'
            }),
        otherwise: Joi.string().pattern(/^\d{9}$|^\d{11}$/).optional().allow(null, '')
            .messages({
                'string.pattern.base': 'RNCOtroContribuyente must be 9 or 11 digits'
            })
    }),

    modifiedNcfDate: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.date().iso().required()
            .messages({
                'any.required': 'FechaNCFModificado is required for Notas (33/34)'
            }),
        otherwise: Joi.date().iso().optional().allow(null)
    }),

    modificationCode: Joi.number().integer().optional().allow(null)
        .messages({
            'number.base': 'CodigoModificacion must be a number',
            'number.integer': 'CodigoModificacion must be an integer'
        }),

    modificationReason: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().max(90).optional().allow(null, '')
            .messages({
                'string.max': 'RazonModificacion cannot exceed 90 characters'
            }),
        otherwise: Joi.forbidden()
            .messages({
                'any.unknown': 'RazonModificacion only applies to Notas (33/34)'
            })
    }),

    // --- Nota de Crédito (34) ---
    indicadorNotaCredito: Joi.when('type', {
        is: '34',
        then: Joi.number().integer().valid(0, 1).required()
            .messages({
                'any.required': 'IndicadorNotaCredito is required for Nota de Crédito (34)',
                'any.only': 'IndicadorNotaCredito must be 0 or 1'
            }),
        otherwise: Joi.forbidden()
    }),

    // --- Campos derivados (forbidden) ---
    exemptAmount: Joi.forbidden()
        .messages({
            'any.unknown': 'exemptAmount se calcula automáticamente sumando las líneas exentas (indicadorFacturacion=4). No lo envíes.'
        }),
    itbis3Base: Joi.forbidden()
        .messages({
            'any.unknown': 'itbis3Base se calcula automáticamente sumando las líneas con indicadorFacturacion=3. No lo envíes.'
        }),
    itbis3Amount: Joi.forbidden()
        .messages({
            'any.unknown': 'itbis3Amount se calcula automáticamente (ITBIS 0% sobre la base). No lo envíes.'
        }),
    totalItbisRetenido: Joi.forbidden()
        .messages({
            'any.unknown': 'totalItbisRetenido se calcula automáticamente desde items[].retencion.montoItbisRetenido. No lo envíes.'
        }),
    totalIsrRetencion: Joi.forbidden()
        .messages({
            'any.unknown': 'totalIsrRetencion se calcula automáticamente desde items[].retencion.montoIsrRetenido. No lo envíes.'
        }),

    // --- Transporte ---
    transporte: Joi.when('type', {
        is: Joi.valid('31', '32', '33', '34', '44', '45', '46', '47'),
        then: transporteSchema,
        otherwise: Joi.forbidden()
    }),

    // --- Informaciones adicionales ---
    informacionesAdicionales: Joi.when('type', {
        is: Joi.valid('41', '43', '47'),
        then: Joi.forbidden(),
        otherwise: informacionesAdicionalesSchema
    }),

    // ============================================================
    // DT30 — IdDoc extendido
    // ============================================================
    indicadorEnvioDiferido: idDocExtrasSchema.extract('indicadorEnvioDiferido')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    indicadorMontoGravado: idDocExtrasSchema.extract('indicadorMontoGravado')
        .when('type', {
            is: Joi.valid('43', '44', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    indicadorServicioTodoIncluido: idDocExtrasSchema.extract('indicadorServicioTodoIncluido')
        .when('type', {
            is: Joi.valid('41', '43', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    tipoIngresos: idDocExtrasSchema.extract('tipoIngresos')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    tipoPago: idDocExtrasSchema.extract('tipoPago'),
    fechaLimitePago: idDocExtrasSchema.extract('fechaLimitePago'),
    terminoPago: idDocExtrasSchema.extract('terminoPago')
        .when('type', {
            is: '34',
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    formasPago: idDocExtrasSchema.extract('formasPago')
        .when('type', {
            is: '34',
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    tipoCuentaPago: idDocExtrasSchema.extract('tipoCuentaPago')
        .when('type', {
            is: '34',
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    numeroCuentaPago: idDocExtrasSchema.extract('numeroCuentaPago')
        .when('type', {
            is: '34',
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    bancoPago: idDocExtrasSchema.extract('bancoPago')
        .when('type', {
            is: '34',
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    fechaDesde: idDocExtrasSchema.extract('fechaDesde')
        .when('type', {
            is: Joi.valid('41', '43'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    fechaHasta: idDocExtrasSchema.extract('fechaHasta')
        .when('type', {
            is: Joi.valid('41', '43'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    totalPaginas: idDocExtrasSchema.extract('totalPaginas'),

    // ============================================================
    // DT30 — Emisor extendido
    // ============================================================
    codigoVendedor: emisorExtrasSchema.extract('codigoVendedor')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    numeroFacturaInterna: emisorExtrasSchema.extract('numeroFacturaInterna'),
    numeroPedidoInterno: emisorExtrasSchema.extract('numeroPedidoInterno'),
    zonaVenta: emisorExtrasSchema.extract('zonaVenta')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    rutaVenta: emisorExtrasSchema.extract('rutaVenta')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    informacionAdicionalEmisor: emisorExtrasSchema.extract('informacionAdicionalEmisor'),

    // ============================================================
    // DT30 — Comprador extendido
    // ============================================================
    contactoComprador: compradorExtrasSchema.extract('contactoComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    correoComprador: compradorExtrasSchema.extract('correoComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    direccionComprador: compradorExtrasSchema.extract('direccionComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    municipioComprador: compradorExtrasSchema.extract('municipioComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    provinciaComprador: compradorExtrasSchema.extract('provinciaComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    fechaEntrega: compradorExtrasSchema.extract('fechaEntrega')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    contactoEntrega: compradorExtrasSchema.extract('contactoEntrega')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    direccionEntrega: compradorExtrasSchema.extract('direccionEntrega')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    telefonoAdicional: compradorExtrasSchema.extract('telefonoAdicional')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    fechaOrdenCompra: compradorExtrasSchema.extract('fechaOrdenCompra')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    numeroOrdenCompra: compradorExtrasSchema.extract('numeroOrdenCompra')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    codigoInternoComprador: compradorExtrasSchema.extract('codigoInternoComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    responsablePago: compradorExtrasSchema.extract('responsablePago')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    informacionAdicionalComprador: compradorExtrasSchema.extract('informacionAdicionalComprador')
        .when('type', {
            is: Joi.valid('43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),

    // ============================================================
    // DT30 — Totales extendido
    // ============================================================
    montoImpuestoAdicional: Joi.forbidden()
        .messages({
            'any.unknown': 'montoImpuestoAdicional se calcula automáticamente sumando los impuestos adicionales de las líneas. No lo envíes.'
        }),
    impuestosAdicionales: Joi.forbidden()
        .messages({
            'any.unknown': 'impuestosAdicionales del encabezado se calcula automáticamente desde items[].impuestosAdicionales. No lo envíes.'
        }),
    montoNoFacturable: totalesExtrasSchema.extract('montoNoFacturable')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    montoPeriodo: totalesExtrasSchema.extract('montoPeriodo'),
    saldoAnterior: totalesExtrasSchema.extract('saldoAnterior'),
    montoAvancePago: totalesExtrasSchema.extract('montoAvancePago'),
    valorPagar: totalesExtrasSchema.extract('valorPagar'),
    totalItbisPercepcion: totalesExtrasSchema.extract('totalItbisPercepcion')
        .when('type', {
            is: Joi.valid('32', '43', '44', '45', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    totalIsrPercepcion: totalesExtrasSchema.extract('totalIsrPercepcion')
        .when('type', {
            is: Joi.valid('32', '43', '44', '45', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),

    // ============================================================
    // DT30 — OtraMoneda (encabezado)
    // ============================================================
    tipoMoneda: otraMonedaSchema.extract('tipoMoneda'),
    tipoCambio: otraMonedaSchema.extract('tipoCambio'),

    montoGravadoTotalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravadoTotalOtraMoneda se calcula automáticamente (montoGravado DOP / tipoCambio). No lo envíes.' }),
    montoGravado1OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado1OtraMoneda se calcula automáticamente (itbis1Base DOP / tipoCambio). No lo envíes.' }),
    montoGravado2OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado2OtraMoneda se calcula automáticamente (itbis2Base DOP / tipoCambio). No lo envíes.' }),
    montoGravado3OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoGravado3OtraMoneda se calcula automáticamente (itbis3Base DOP / tipoCambio). No lo envíes.' }),
    montoExentoOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoExentoOtraMoneda se calcula automáticamente (exemptAmount DOP / tipoCambio). No lo envíes.' }),
    totalItbisOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbisOtraMoneda se calcula automáticamente (itbis DOP / tipoCambio). No lo envíes.' }),
    totalItbis1OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis1OtraMoneda se calcula automáticamente (itbis1Amount DOP / tipoCambio). No lo envíes.' }),
    totalItbis2OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis2OtraMoneda se calcula automáticamente (itbis2Amount DOP / tipoCambio). No lo envíes.' }),
    totalItbis3OtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'totalItbis3OtraMoneda se calcula automáticamente (itbis3Amount DOP / tipoCambio). No lo envíes.' }),
    montoImpuestoAdicionalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoImpuestoAdicionalOtraMoneda se calcula automáticamente. No lo envíes.' }),
    impuestosAdicionalesOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'impuestosAdicionalesOtraMoneda se calcula automáticamente. No lo envíes.' }),
    montoTotalOtraMoneda: Joi.forbidden()
        .messages({ 'any.unknown': 'montoTotalOtraMoneda se calcula automáticamente (total DOP / tipoCambio). No lo envíes.' }),

    // ============================================================
    // DT32 — Subtotales
    // ============================================================
    subtotales: Joi.array()
        .items(subtotalSchema)
        .max(20)
        .optional()
        .allow(null)
        .messages({
            'array.max': 'No puede haber más de 20 subtotales'
        }),

    // ============================================================
    // DT33 — Descuentos o Recargos globales
    // ============================================================
    descuentosORecargos: Joi.array()
        .items(descuentoORecargoSchema)
        .max(20)
        .optional()
        .allow(null)
        .messages({
            'array.max': 'No puede haber más de 20 descuentos o recargos'
        }),

    // ============================================================
    // Líneas
    // ============================================================
    items: Joi.array()
        .items(itemSchema)
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'At least one item is required',
            'array.max': 'Invoice cannot have more than 100 items',
            'any.required': 'Items array is required'
        })
});

module.exports = { createInvoiceSchemaBase };