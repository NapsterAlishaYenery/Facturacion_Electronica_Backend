// ============================================================
// Validaciones Joi para el módulo invoices
// ============================================================

const Joi = require('joi');

// ============================================================
// Schemas de query
// ============================================================

const listInvoicesQuerySchema = Joi.object({
    status: Joi.string()
        .valid('draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency')
        .optional(),
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    receiverRnc: Joi.string().max(15).optional(),
    ncf: Joi.string().max(20).optional(),
    hasTrackId: Joi.boolean().truthy('true').falsy('false').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

const listAllInvoicesQuerySchema = Joi.object({
    companyId: Joi.string().uuid().optional(),
    status: Joi.string()
        .valid('draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency')
        .optional(),
    type: Joi.string()
        .valid('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
        .optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    receiverRnc: Joi.string().max(15).optional(),
    ncf: Joi.string().max(20).optional(),
    hasTrackId: Joi.boolean().truthy('true').falsy('false').optional(),
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ============================================================
// Sub-schemas reutilizables
// ============================================================

// Item de línea — se usa en create y en update
const itemSchema = Joi.object({
    // ---------- Identificación ----------
    itemCode: Joi.string().max(50).optional().allow(null, ''),

    // DT31 — <TablaCodigosItem> (hasta 5)
    additionalCodes: Joi.array().items(
        Joi.object({
            tipoCodigo: Joi.string().valid('Interna', 'EAN', 'PLU', 'DUN').optional()
                .messages({ 'any.only': 'tipoCodigo must be Interna, EAN, PLU or DUN' }),
            codigoItem: Joi.string().max(35).required()
                .messages({
                    'any.required': 'additionalCodes[].codigoItem is required',
                    'string.max': 'additionalCodes[].codigoItem cannot exceed 35 characters'
                })
        })
    ).max(5).optional().allow(null)
        .messages({ 'array.max': 'additionalCodes cannot have more than 5 items' }),

    // NombreItem (obligatorio DGII, máx 80 chars)
    itemName: Joi.string().min(1).max(80).required()
        .messages({
            'any.required': 'Item name (itemName) is required',
            'string.min': 'Item name cannot be empty',
            'string.max': 'Item name cannot exceed 80 characters'
        }),

    // DescripcionItem (opcional DGII, máx 1000 chars)
    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({ 'string.max': 'Item description cannot exceed 1000 characters' }),

    // ---------- Naturaleza del ítem ----------
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).default(1)
        .messages({ 'any.only': 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)' }),

    unidadMedida: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadMedida must be between 1 and 62',
            'number.max': 'unidadMedida must be between 1 and 62'
        }),

    // ---------- Cantidades y precios ----------
    quantity: Joi.number().positive().max(9999999.9999).required()
        .messages({
            'number.positive': 'Item quantity must be greater than 0',
            'any.required': 'Item quantity is required'
        }),
    unitPrice: Joi.number().min(0).max(9999999999.9999).required()
        .messages({
            'number.min': 'Item unit price cannot be negative',
            'any.required': 'Item unit price is required'
        }),
    discount: Joi.number().min(0).default(0)
        .messages({ 'number.min': 'Item discount cannot be negative' }),
    recargo: Joi.number().min(0).default(0)
        .messages({ 'number.min': 'Item recargo cannot be negative' }),

    // ---------- Referencias opcionales ----------
    cantidadReferencia: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'cantidadReferencia cannot be negative' }),
    unidadReferencia: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadReferencia must be between 1 and 62',
            'number.max': 'unidadReferencia must be between 1 and 62'
        }),
    gradosAlcohol: Joi.number().min(0).max(100).optional().allow(null)
        .messages({
            'number.min': 'gradosAlcohol cannot be negative',
            'number.max': 'gradosAlcohol cannot exceed 100'
        }),
    precioUnitarioReferencia: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'precioUnitarioReferencia cannot be negative' }),
    fechaElaboracion: Joi.date().iso().optional().allow(null),
    fechaVencimientoItem: Joi.date().iso().optional().allow(null),

    // ---------- DT31 — Subcantidades (hasta 5) ----------
    subcantidades: Joi.array().items(
        Joi.object({
            subcantidad: Joi.number().min(0).required()
                .messages({ 'any.required': 'subcantidades[].subcantidad is required' }),
            codigoSubcantidad: Joi.number().integer().min(1).max(62).required()
                .messages({
                    'any.required': 'subcantidades[].codigoSubcantidad is required',
                    'number.min': 'codigoSubcantidad must be 1-62',
                    'number.max': 'codigoSubcantidad must be 1-62'
                })
        })
    ).max(5).optional().allow(null)
        .messages({ 'array.max': 'subcantidades cannot have more than 5 items' }),

    // ---------- DT31 — SubDescuentos (hasta 12) ----------
    subDescuentos: Joi.array().items(
        Joi.object({
            tipoSubDescuento: Joi.string().valid('$', '%').required()
                .messages({ 'any.only': 'tipoSubDescuento must be "$" or "%"' }),
            subDescuentoPorcentaje: Joi.number().min(0).max(100).when('tipoSubDescuento', {
                is: '%',
                then: Joi.required(),
                otherwise: Joi.optional().allow(null)
            }),
            montoSubDescuento: Joi.number().min(0).required()
                .messages({ 'any.required': 'montoSubDescuento is required' })
        })
    ).max(12).optional().allow(null)
        .messages({ 'array.max': 'subDescuentos cannot have more than 12 items' }),

    // ---------- DT31 — SubRecargos (hasta 12) ----------
    subRecargos: Joi.array().items(
        Joi.object({
            tipoSubRecargo: Joi.string().valid('$', '%').required()
                .messages({ 'any.only': 'tipoSubRecargo must be "$" or "%"' }),
            subRecargoPorcentaje: Joi.number().min(0).max(100).when('tipoSubRecargo', {
                is: '%',
                then: Joi.required(),
                otherwise: Joi.optional().allow(null)
            }),
            montoSubRecargo: Joi.number().min(0).required()
                .messages({ 'any.required': 'montoSubRecargo is required' })
        })
    ).max(12).optional().allow(null)
        .messages({ 'array.max': 'subRecargos cannot have more than 12 items' }),

    // ---------- DT31 — Impuestos adicionales por ítem (hasta 2) ----------
    impuestosAdicionales: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required()
                .messages({
                    'string.pattern.base': 'impuestosAdicionales[].codigo must be 3 digits (001-039)',
                    'any.required': 'impuestosAdicionales[].codigo is required'
                })
        })
    ).max(2).optional().allow(null)
        .messages({ 'array.max': 'impuestosAdicionales cannot have more than 2 items' }),

    // ---------- DT31 — Minería ----------
    pesoNetoKilogramo: Joi.number().min(0).optional().allow(null),
    pesoNetoMineria: Joi.number().min(0).optional().allow(null),
    tipoAfiliacion: Joi.number().integer().valid(1, 2).optional().allow(null),
    liquidacion: Joi.number().integer().valid(1, 2).optional().allow(null),

    // ---------- DT32 — Subtotal informativo (<Subtotales> del XML) ----------
    // El cliente marca esta línea como perteneciente al subtotal N.
    // NULL/undefined = la línea no entra en ningún subtotal (válido).
    // El service calcula los montos del subtotal sumando las líneas
    // que comparten el mismo subtotalId.
    subtotalId: Joi.number().integer().min(1).max(20).optional().allow(null)
        .messages({
            'number.min': 'subtotalId must be between 1 and 20',
            'number.max': 'subtotalId must be between 1 and 20'
        }),

    // ---------- ITBIS ----------
    indicadorFacturacion: Joi.number().integer().valid(0, 1, 2, 3, 4).optional()
        .messages({ 'any.only': 'indicadorFacturacion must be 0-4' }),
    itbisRate: Joi.number().min(0).max(100).default(18)
        .messages({
            'number.min': 'ITBIS rate cannot be negative',
            'number.max': 'ITBIS rate cannot exceed 100'
        }),

    // ---------- Retenciones (41, 47) ----------
    retencion: Joi.object({
        indicador: Joi.number().integer().valid(1, 2).required()
            .messages({ 'any.required': 'Retencion.indicador is required' }),
        montoItbisRetenido: Joi.number().min(0).optional().allow(null),
        montoIsrRetenido: Joi.number().min(0).optional().allow(null)
    }).optional().allow(null)
});

// ============================================================
// DT32 — Sub-schema: Subtotales
//
// El cliente SOLO manda el agrupamiento:
//   - numeroSubtotal: secuencial 1-20
//   - descripcion:    texto libre (ej: "Bebidas")
//   - orden:          opcional, para ordenar
//
// El agrupamiento real se hace por `items[].subtotalId`:
// cada línea con subtotalId=N pertenece al subtotal N.
//
// Los montos (montoGravadoTotal, subTotalItbis, montoSubTotal, etc.)
// los calcula el SERVICE sumando las líneas del grupo. NUNCA se
// aceptan del cliente. `.unknown(false)` rechaza cualquier monto
// que el cliente intente mandar.
// ============================================================
const subtotalSchema = Joi.object({
    numeroSubtotal: Joi.number().integer().min(1).max(20).required()
        .messages({
            'any.required': 'numeroSubtotal is required',
            'number.min': 'numeroSubtotal must be between 1 and 20',
            'number.max': 'numeroSubtotal must be between 1 and 20'
        }),
    descripcion: Joi.string().max(40).optional().allow(null, '')
        .messages({ 'string.max': 'DescripcionSubtotal cannot exceed 40 characters' }),
    orden: Joi.number().integer().min(1).optional().allow(null)
}).unknown(false)
    .messages({
        'object.unknown': 'subtotales[] solo acepta numeroSubtotal, descripcion y orden. Los montos los calcula el sistema a partir de items[].subtotalId.'
    });

// ============================================================
// DT33 — Sub-schema: Descuentos o Recargos globales (hasta 20)
// ============================================================
const descuentoORecargoSchema = Joi.object({
    numeroLinea: Joi.number().integer().min(1).max(20).required()
        .messages({
            'any.required': 'numeroLinea is required',
            'number.min': 'numeroLinea must be between 1 and 20',
            'number.max': 'numeroLinea must be between 1 and 20'
        }),
    tipoAjuste: Joi.string().valid('D', 'R').required()
        .messages({
            'any.required': 'tipoAjuste is required',
            'any.only': 'tipoAjuste must be "D" (descuento) or "R" (recargo)'
        }),
    indicadorNorma1007: Joi.number().integer().valid(1).optional().allow(null)
        .messages({
            'any.only': 'indicadorNorma1007 must be 1 or null'
        }),
    descripcion: Joi.string().max(45).optional().allow(null, '')
        .messages({
            'string.max': 'DescripcionDescuentooRecargo cannot exceed 45 characters'
        }),
    tipoValor: Joi.string().valid('%', '$').required()
        .messages({
            'any.required': 'tipoValor is required',
            'any.only': 'tipoValor must be "%" (porcentaje) or "$" (monto)'
        }),
    valor: Joi.when('tipoValor', {
        is: '%',
        then: Joi.number().positive().max(100).required()
            .messages({
                'any.required': 'valor is required when tipoValor is "%"',
                'number.positive': 'valor must be greater than 0 when tipoValor is "%"',
                'number.max': 'valor cannot exceed 100'
            }),
        otherwise: Joi.forbidden()
            .messages({ 'any.unknown': 'valor must not be provided when tipoValor is "$"' })
    }),
    monto: Joi.when('tipoValor', {
        is: '$',
        then: Joi.number().min(0).required()
            .messages({
                'any.required': 'monto is required when tipoValor is "$"',
                'number.min': 'monto cannot be negative'
            }),
        otherwise: Joi.number().min(0).optional().allow(null)
            .messages({ 'number.min': 'monto cannot be negative' })
    }),
    montoOtraMoneda: Joi.number().min(0).optional().allow(null)
        .messages({ 'number.min': 'montoOtraMoneda cannot be negative' }),
    indicadorFacturacion: Joi.number().integer().valid(1, 2, 3, 4).required()
        .messages({
            'any.required': 'indicadorFacturacion is required',
            'any.only': 'indicadorFacturacion must be 1, 2, 3 or 4'
        })
});

// Transporte — solo aplica en tipos 31, 32, 33, 34, 44, 45, 46, 47
const transporteSchema = Joi.object({
    viaTransporte: Joi.string().valid('01', '02', '03').optional()
        .messages({
            'any.only': 'Via de transporte must be 01 (Terrestre), 02 (Marítimo) or 03 (Aérea)'
        }),
    paisOrigen: Joi.string().max(60).optional().allow(null, ''),
    direccionDestino: Joi.string().max(100).optional().allow(null, ''),
    paisDestino: Joi.string().max(60).optional().allow(null, ''),
    rncCompaniaTransportista: Joi.string().max(20).optional().allow(null, ''),
    nombreCompaniaTransportista: Joi.string().max(150).optional().allow(null, ''),
    numeroViaje: Joi.string().max(20).optional().allow(null, ''),
    conductor: Joi.string().max(20).optional().allow(null, ''),
    documentoTransporte: Joi.string().max(20).optional().allow(null, ''),
    ficha: Joi.string().max(10).optional().allow(null, ''),
    placa: Joi.string().max(7).optional().allow(null, ''),
    rutaTransporte: Joi.string().max(20).optional().allow(null, ''),
    zonaTransporte: Joi.string().max(20).optional().allow(null, ''),
    numeroAlbaran: Joi.string().max(20).optional().allow(null, '')
}).optional().allow(null);

// Informaciones adicionales — SOLO tipo 46 (exportación)
const informacionesAdicionalesSchema = Joi.object({
    fechaEmbarque: Joi.date().iso().optional().allow(null),
    numeroEmbarque: Joi.string().max(25).optional().allow(null, ''),
    numeroContenedor: Joi.string().max(100).optional().allow(null, ''),
    nombrePuertoEmbarque: Joi.string().max(40).optional().allow(null, ''),
    condicionesEntrega: Joi.string().max(3).optional().allow(null, ''),
    totalFob: Joi.number().min(0).optional().allow(null),
    seguro: Joi.number().min(0).optional().allow(null),
    flete: Joi.number().min(0).optional().allow(null),
    otrosGastos: Joi.number().min(0).optional().allow(null),
    totalCif: Joi.number().min(0).optional().allow(null),
    regimenAduanero: Joi.string().max(35).optional().allow(null, ''),
    nombrePuertoSalida: Joi.string().max(40).optional().allow(null, ''),
    nombrePuertoDesembarque: Joi.string().max(40).optional().allow(null, '')
}).optional().allow(null);

// ============================================================
// DT30 — Sub-schemas reutilizables por sección del PDF DGII
// ============================================================

// IdDoc — campos extendidos
const idDocExtrasSchema = Joi.object({
    indicadorEnvioDiferido: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorEnvioDiferido must be 0 or 1' }),
    indicadorMontoGravado: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorMontoGravado must be 0 or 1' }),
    indicadorServicioTodoIncluido: Joi.number().integer().valid(0, 1).optional().allow(null)
        .messages({ 'any.only': 'indicadorServicioTodoIncluido must be 0 or 1' }),
    tipoIngresos: Joi.string().valid('01', '02', '03', '04', '05', '06').optional().allow(null)
        .messages({ 'any.only': 'tipoIngresos must be 01-06' }),
    tipoPago: Joi.number().integer().valid(1, 2, 3).optional().allow(null)
        .messages({ 'any.only': 'tipoPago must be 1 (Contado), 2 (Crédito) or 3 (Gratuito)' }),
    fechaLimitePago: Joi.date().iso().optional().allow(null),
    terminoPago: Joi.string().max(15).optional().allow(null, ''),
    formasPago: Joi.array().items(
        Joi.object({
            formaPago: Joi.number().integer().min(1).max(8).required()
                .messages({ 'number.min': 'formaPago must be 1-8', 'number.max': 'formaPago must be 1-8' }),
            montoPago: Joi.number().min(0).required()
                .messages({ 'number.min': 'montoPago cannot be negative' })
        })
    ).max(7).optional().allow(null)
        .messages({ 'array.max': 'formasPago cannot have more than 7 items' }),
    tipoCuentaPago: Joi.string().valid('CT', 'AH', 'OT').optional().allow(null)
        .messages({ 'any.only': 'tipoCuentaPago must be CT, AH or OT' }),
    numeroCuentaPago: Joi.string().max(28).optional().allow(null, ''),
    bancoPago: Joi.string().max(75).optional().allow(null, ''),
    fechaDesde: Joi.date().iso().optional().allow(null),
    fechaHasta: Joi.date().iso().optional().allow(null),
    totalPaginas: Joi.number().integer().min(1).optional().allow(null)
});

// Emisor — campos que viven en Invoice (no en Company)
const emisorExtrasSchema = Joi.object({
    codigoVendedor: Joi.string().max(60).optional().allow(null, ''),
    numeroFacturaInterna: Joi.string().max(20).optional().allow(null, ''),
    numeroPedidoInterno: Joi.string().max(20).optional().allow(null, ''),
    zonaVenta: Joi.string().max(20).optional().allow(null, ''),
    rutaVenta: Joi.string().max(20).optional().allow(null, ''),
    informacionAdicionalEmisor: Joi.string().max(250).optional().allow(null, '')
});

// Comprador — campos extendidos
const compradorExtrasSchema = Joi.object({
    contactoComprador: Joi.string().max(80).optional().allow(null, ''),
    correoComprador: Joi.string().email().max(80).optional().allow(null, '')
        .messages({ 'string.email': 'correoComprador must be a valid email' }),
    direccionComprador: Joi.string().max(100).optional().allow(null, ''),
    municipioComprador: Joi.string().pattern(/^\d{6}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'municipioComprador must be 6 digits (Tabla III)' }),
    provinciaComprador: Joi.string().pattern(/^\d{6}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'provinciaComprador must be 6 digits (Tabla III)' }),
    fechaEntrega: Joi.date().iso().optional().allow(null),
    contactoEntrega: Joi.string().max(100).optional().allow(null, ''),
    direccionEntrega: Joi.string().max(100).optional().allow(null, ''),
    telefonoAdicional: Joi.string().pattern(/^\d{3}-\d{3}-\d{4}$/).optional().allow(null, '')
        .messages({ 'string.pattern.base': 'telefonoAdicional must have format xxx-xxx-xxxx' }),
    fechaOrdenCompra: Joi.date().iso().optional().allow(null),
    numeroOrdenCompra: Joi.string().max(20).optional().allow(null, ''),
    codigoInternoComprador: Joi.string().max(20).optional().allow(null, ''),
    responsablePago: Joi.string().max(20).optional().allow(null, ''),
    informacionAdicionalComprador: Joi.string().max(150).optional().allow(null, '')
});

// InformacionesAdicionales — extendido (pesos, bultos, referencia)
const infoAdicionalExtrasSchema = Joi.object({
    numeroReferencia: Joi.string().max(20).optional().allow(null, ''),
    pesoBruto: Joi.number().min(0).optional().allow(null),
    pesoNeto: Joi.number().min(0).optional().allow(null),
    unidadPesoBruto: Joi.number().integer().min(1).max(62).optional().allow(null),
    unidadPesoNeto: Joi.number().integer().min(1).max(62).optional().allow(null),
    cantidadBulto: Joi.number().min(0).optional().allow(null),
    unidadBulto: Joi.number().integer().min(1).max(62).optional().allow(null),
    volumenBulto: Joi.number().min(0).optional().allow(null),
    unidadVolumen: Joi.number().integer().min(1).max(62).optional().allow(null)
});

// Totales — extendido (impuestos adicionales, montos extra)
const totalesExtrasSchema = Joi.object({
    montoImpuestoAdicional: Joi.number().min(0).optional().allow(null),
    impuestosAdicionales: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required()
                .messages({ 'string.pattern.base': 'impuestosAdicionales[].codigo must be 3 digits (001-039)' }),
            tasa: Joi.number().min(0).optional().allow(null),
            iscEspecifico: Joi.number().min(0).optional().allow(null),
            iscAdvalorem: Joi.number().min(0).optional().allow(null),
            otros: Joi.number().min(0).optional().allow(null)
        })
    ).max(20).optional().allow(null)
        .messages({ 'array.max': 'impuestosAdicionales cannot have more than 20 items' }),
    montoNoFacturable: Joi.number().min(0).optional().allow(null),
    montoPeriodo: Joi.number().min(0).optional().allow(null),
    saldoAnterior: Joi.number().optional().allow(null),
    montoAvancePago: Joi.number().min(0).optional().allow(null),
    valorPagar: Joi.number().optional().allow(null),
    totalItbisPercepcion: Joi.number().min(0).optional().allow(null),
    totalIsrPercepcion: Joi.number().min(0).optional().allow(null)
});

// OtraMoneda — encabezado
const otraMonedaSchema = Joi.object({
    tipoMoneda: Joi.string().length(3).uppercase().optional().allow(null, '')
        .messages({ 'string.length': 'tipoMoneda must be 3 chars ISO 4217' }),
    tipoCambio: Joi.number().positive().optional().allow(null)
        .messages({ 'number.positive': 'tipoCambio must be > 0' }),
    montoGravadoTotalOtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado1OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado2OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoGravado3OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoExentoOtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbisOtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis1OtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis2OtraMoneda: Joi.number().min(0).optional().allow(null),
    totalItbis3OtraMoneda: Joi.number().min(0).optional().allow(null),
    montoImpuestoAdicionalOtraMoneda: Joi.number().min(0).optional().allow(null),
    impuestosAdicionalesOtraMoneda: Joi.array().items(
        Joi.object({
            codigo: Joi.string().pattern(/^\d{3}$/).required(),
            tasa: Joi.number().min(0).optional().allow(null),
            iscEspecifico: Joi.number().min(0).optional().allow(null),
            iscAdvalorem: Joi.number().min(0).optional().allow(null),
            otros: Joi.number().min(0).optional().allow(null)
        })
    ).max(20).optional().allow(null),
    montoTotalOtraMoneda: Joi.number().min(0).optional().allow(null)
});

// ============================================================
// Schema: crear factura (company_admin)
// ============================================================

const createInvoiceSchema = Joi.object({
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
        otherwise: Joi.forbidden()
    }),
    modifiedNcfIssuerRnc: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().max(15).optional().allow(null, ''),
        otherwise: Joi.forbidden()
    }),
    modifiedNcfDate: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.date().iso().required()
            .messages({
                'any.required': 'FechaNCFModificado is required for Notas (33/34)'
            }),
        otherwise: Joi.forbidden()
    }),
    modificationCode: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.number().integer().min(1).max(5).required()
            .messages({
                'any.required': 'CodigoModificacion is required for Notas (33/34)',
                'number.min': 'CodigoModificacion must be between 1 and 5',
                'number.max': 'CodigoModificacion must be between 1 and 5'
            }),
        otherwise: Joi.forbidden()
    }),
    modificationReason: Joi.when('type', {
        is: Joi.valid('33', '34'),
        then: Joi.string().max(90).optional().allow(null, ''),
        otherwise: Joi.forbidden()
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

    // --- Monto exento (43, 44, 47) ---
    exemptAmount: Joi.when('type', {
        is: Joi.valid('43', '44', '47'),
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),

    // --- ITBIS3 (46) ---
    itbis3Base: Joi.when('type', {
        is: '46',
        then: Joi.number().min(0).required()
            .messages({ 'any.required': 'itbis3Base is required for e-CF 46' }),
        otherwise: Joi.forbidden()
    }),
    itbis3Amount: Joi.when('type', {
        is: '46',
        then: Joi.number().min(0).required()
            .messages({ 'any.required': 'itbis3Amount is required for e-CF 46' }),
        otherwise: Joi.forbidden()
    }),

    // --- Retención encabezado (41, 47) ---
    totalItbisRetenido: Joi.when('type', {
        is: '41',
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),
    totalIsrRetencion: Joi.when('type', {
        is: '47',
        then: Joi.number().min(0).optional(),
        otherwise: Joi.forbidden()
    }),

    // --- Transporte (todos excepto 41, 43) ---
    transporte: Joi.when('type', {
        is: Joi.valid('31', '32', '33', '34', '44', '45', '46', '47'),
        then: transporteSchema,
        otherwise: Joi.forbidden()
    }),

    // --- Informaciones adicionales (solo 46) ---
    informacionesAdicionales: Joi.when('type', {
        is: '46',
        then: informacionesAdicionalesSchema,
        otherwise: Joi.forbidden()
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
    // DT30 — InformacionesAdicionales extendido (pesos, bultos, ref)
    // ============================================================
    numeroReferencia: infoAdicionalExtrasSchema.extract('numeroReferencia')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null, '')
        }),
    pesoBruto: infoAdicionalExtrasSchema.extract('pesoBruto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    pesoNeto: infoAdicionalExtrasSchema.extract('pesoNeto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    unidadPesoBruto: infoAdicionalExtrasSchema.extract('unidadPesoBruto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    unidadPesoNeto: infoAdicionalExtrasSchema.extract('unidadPesoNeto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    cantidadBulto: infoAdicionalExtrasSchema.extract('cantidadBulto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    unidadBulto: infoAdicionalExtrasSchema.extract('unidadBulto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    volumenBulto: infoAdicionalExtrasSchema.extract('volumenBulto')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    unidadVolumen: infoAdicionalExtrasSchema.extract('unidadVolumen')
        .when('type', {
            is: Joi.valid('41', '43', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),

    // ============================================================
    // DT30 — Totales extendido
    // ============================================================
    montoImpuestoAdicional: totalesExtrasSchema.extract('montoImpuestoAdicional')
        .when('type', {
            is: Joi.valid('41', '43', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
        }),
    impuestosAdicionales: totalesExtrasSchema.extract('impuestosAdicionales')
        .when('type', {
            is: Joi.valid('41', '43', '46', '47'),
            then: Joi.forbidden(),
            otherwise: Joi.optional().allow(null)
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
    montoGravadoTotalOtraMoneda: otraMonedaSchema.extract('montoGravadoTotalOtraMoneda'),
    montoGravado1OtraMoneda: otraMonedaSchema.extract('montoGravado1OtraMoneda'),
    montoGravado2OtraMoneda: otraMonedaSchema.extract('montoGravado2OtraMoneda'),
    montoGravado3OtraMoneda: otraMonedaSchema.extract('montoGravado3OtraMoneda'),
    montoExentoOtraMoneda: otraMonedaSchema.extract('montoExentoOtraMoneda'),
    totalItbisOtraMoneda: otraMonedaSchema.extract('totalItbisOtraMoneda'),
    totalItbis1OtraMoneda: otraMonedaSchema.extract('totalItbis1OtraMoneda'),
    totalItbis2OtraMoneda: otraMonedaSchema.extract('totalItbis2OtraMoneda'),
    totalItbis3OtraMoneda: otraMonedaSchema.extract('totalItbis3OtraMoneda'),
    montoImpuestoAdicionalOtraMoneda: otraMonedaSchema.extract('montoImpuestoAdicionalOtraMoneda'),
    impuestosAdicionalesOtraMoneda: otraMonedaSchema.extract('impuestosAdicionalesOtraMoneda'),
    montoTotalOtraMoneda: otraMonedaSchema.extract('montoTotalOtraMoneda'),

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
})
    .custom((value, helpers) => {
        // 1. issuedAt: no futuro, no más de 30 días atrás
        if (value.issuedAt) {
            const issuedAt = new Date(value.issuedAt);
            const now = new Date();
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            if (issuedAt > now) {
                return helpers.error('any.custom', { message: 'issuedAt cannot be in the future' });
            }
            // NOTA: el bloque de "no más de 30 días atrás" está comentado para test
            // if (issuedAt < thirtyDaysAgo) {
            //     return helpers.error('any.custom', { message: 'issuedAt cannot be more than 30 days in the past' });
            // }
        }

        // 2. Por línea: coherencia indicador ↔ itbisRate
        //    + discount no puede superar quantity × unitPrice
        //    + reglas cruzadas DGII (Step 4)
        for (let i = 0; i < value.items.length; i++) {
            const item = value.items[i];

            // 2.a. Coherencia indicador ↔ tasa
            const expectedRates = {
                0: 0,    // No Facturable
                1: 18,   // ITBIS 18%
                2: 16,   // ITBIS 16%
                3: 0,    // ITBIS 3 (0% gravado)
                4: 0     // Exento
            };

            let indicador = item.indicadorFacturacion;

            if (indicador === undefined) {
                if (item.itbisRate === 18) indicador = 1;
                else if (item.itbisRate === 16) indicador = 2;
                else if (item.itbisRate === 0) indicador = 4;
                else indicador = 4;
            }

            const expectedRate = expectedRates[indicador];
            if (item.itbisRate !== undefined && Number(item.itbisRate) !== expectedRate) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: itbisRate (${item.itbisRate}) no coincide con indicadorFacturacion=${indicador} (esperado ${expectedRate}). Usa 1=18%, 2=16%, 3=0% gravado, 4=exento.`
                });
            }

            // 2.b. indicadorFacturacion=3 solo aplica a tipo 46
            if (indicador === 3 && value.type !== '46') {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: indicadorFacturacion=3 (ITBIS 0% gravado) solo aplica a tipo 46 (exportaciones). Para 0% usa indicadorFacturacion=4 (exento).`
                });
            }

            // 2.c. discount no puede superar quantity × unitPrice
            const lineBase = (item.quantity * item.unitPrice) - item.discount;
            if (lineBase < 0) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
                });
            }

            // 2.d. Bien requiere unidadMedida (regla estricta DGII)
            const indicadorBienoServicio = item.indicadorBienoServicio ?? 1;
            if (indicadorBienoServicio === 1) {
                if (item.unidadMedida === undefined || item.unidadMedida === null) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.`
                    });
                }
            }

            // 2.e. Coherencia cantidadReferencia ↔ unidadReferencia
            const hasCantRef = item.cantidadReferencia !== undefined && item.cantidadReferencia !== null;
            const hasUniRef = item.unidadReferencia !== undefined && item.unidadReferencia !== null;
            if (hasCantRef && !hasUniRef) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: unidadReferencia is required when cantidadReferencia is provided`
                });
            }
            if (hasUniRef && !hasCantRef) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: cantidadReferencia is required when unidadReferencia is provided`
                });
            }

            // 2.f. fechaVencimientoItem >= fechaElaboracion
            if (item.fechaElaboracion && item.fechaVencimientoItem) {
                const elab = new Date(item.fechaElaboracion);
                const venc = new Date(item.fechaVencimientoItem);
                if (venc < elab) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: fechaVencimientoItem (${item.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${item.fechaElaboracion})`
                    });
                }
            }

            // 2.g. gradosAlcohol solo aplica a bienes
            if (indicadorBienoServicio === 2
                && item.gradosAlcohol !== undefined
                && item.gradosAlcohol !== null) {
                return helpers.error('any.custom', {
                    message: `Item ${i + 1}: gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios`
                });
            }
        }

        // 3. Coherencia IndicadorNotaCredito con fechas (regla DGII)
        if (value.type === '34' && value.modifiedNcfDate && value.indicadorNotaCredito !== undefined) {
            const modDate = new Date(value.modifiedNcfDate);
            const issuedDate = value.issuedAt ? new Date(value.issuedAt) : new Date();
            const diffDays = (issuedDate - modDate) / (1000 * 60 * 60 * 24);

            if (diffDays > 30 && value.indicadorNotaCredito !== 1) {
                return helpers.error('any.custom', {
                    message: 'IndicadorNotaCredito must be 1 when the original NCF is more than 30 days old'
                });
            }
            if (diffDays <= 30 && value.indicadorNotaCredito !== 0) {
                return helpers.error('any.custom', {
                    message: 'IndicadorNotaCredito must be 0 when the original NCF is 30 days old or less'
                });
            }
        }

        // 4. Coherencia por tipo: comprador obligatorio/opcional
        const typeNeedsRnc = ['31', '41', '45'];
        const typeNeedsRazonSocial = ['31', '41', '44', '45', '46'];

        if (typeNeedsRnc.includes(value.type) && !value.receiverRnc) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverRnc`
            });
        }
        if (typeNeedsRazonSocial.includes(value.type) && !value.receiverName) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverName`
            });
        }

        // 5. 43 (Gastos Menores) no admite comprador
        if (value.type === '43' && (value.receiverRnc || value.receiverName)) {
            return helpers.error('any.custom', {
                message: 'Type 43 (Gastos Menores) cannot have a buyer'
            });
        }

        // 6. 46 / 47 requieren identificador extranjero si no hay RNC
        if ((value.type === '46' || value.type === '47')
            && !value.receiverRnc
            && !value.receiverIdentificadorExtranjero) {
            return helpers.error('any.custom', {
                message: `Type ${value.type} requires receiverRnc or receiverIdentificadorExtranjero`
            });
        }

        // 7. 46 requiere itbis3Base y itbis3Amount
        if (value.type === '46') {
            if (value.itbis3Base === undefined || value.itbis3Base === null) {
                return helpers.error('any.custom', { message: 'Type 46 requires itbis3Base' });
            }
            if (value.itbis3Amount === undefined || value.itbis3Amount === null) {
                return helpers.error('any.custom', { message: 'Type 46 requires itbis3Amount' });
            }
        }

        // ============================================================
        // DT31 — Validaciones cruzadas del <Item>
        // ============================================================

        // 8. Retención por línea: solo permitida en 31, 33, 34, 41, 47
        const tiposConRetencion = ['31', '33', '34', '41', '47'];
        if (!tiposConRetencion.includes(value.type)) {
            for (let i = 0; i < value.items.length; i++) {
                if (value.items[i].retencion) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: retencion only applies to types 31, 33, 34, 41 and 47`
                    });
                }
            }
        }

        // 9. Tipos 41 y 47: cada línea DEBE llevar retención
        if (['41', '47'].includes(value.type)) {
            for (let i = 0; i < value.items.length; i++) {
                if (!value.items[i].retencion) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: retencion is required for types 41 and 47`
                    });
                }
            }
        }

        // 10. IndicadorFacturacion forzado por tipo
        //     43, 44, 47 → 4 (Exento)
        //     46 → 3 (ITBIS 0%)
        if (['43', '44', '47'].includes(value.type)) {
            for (let i = 0; i < value.items.length; i++) {
                const ind = Number(value.items[i].indicadorFacturacion ?? 4);
                if (ind !== 4) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: type ${value.type} requires indicadorFacturacion=4 (Exento)`
                    });
                }
            }
        }
        if (value.type === '46') {
            for (let i = 0; i < value.items.length; i++) {
                const ind = Number(value.items[i].indicadorFacturacion ?? 4);
                if (ind !== 3) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: type 46 requires indicadorFacturacion=3 (ITBIS 0%)`
                    });
                }
            }
        }

        // 11. Tipo 47: indicadorBienoServicio = 2 (Servicio)
        if (value.type === '47') {
            for (let i = 0; i < value.items.length; i++) {
                const ind = Number(value.items[i].indicadorBienoServicio ?? 1);
                if (ind !== 2) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: type 47 requires indicadorBienoServicio=2 (Servicio)`
                    });
                }
            }
        }

        // 12. MontoITBISRetenido = 0 cuando indicadorFacturacion=4 + retención
        // 12. MontoITBISRetenido: si indicador=4 (exento) + retención tipo "retención" (indicador=1),
        //     el montoItbisRetenido debe ser 0 (no hay ITBIS que retener).
        //     Si el ítem es GRAVADO (indicador 0,1,2,3) y hay retención, NO se toca.
        for (let i = 0; i < value.items.length; i++) {
            const item = value.items[i];
            const ind = Number(item.indicadorFacturacion ?? 4);
            if (ind === 4 && item.retencion && item.retencion.indicador === 1) {
                item.retencion.montoItbisRetenido = 0;
            }
        }

        // 13. e-CF 32: si el total >= 250,000 requiere identificación del comprador
        if (value.type === '32') {
            const total = value.items.reduce((sum, it) => {
                const base = (it.quantity * it.unitPrice)
                    - (it.discount || 0)
                    + (it.recargo || 0);
                const itbis = base * ((it.itbisRate ?? 18) / 100);
                return sum + base + itbis;
            }, 0);

            if (total >= 250000) {
                if (!value.receiverRnc) {
                    return helpers.error('any.custom', {
                        message: 'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)'
                    });
                }
                if (!value.receiverName) {
                    return helpers.error('any.custom', {
                        message: 'Type 32 with total >= 250,000 requires receiverName (DGII rule)'
                    });
                }
            }
        }

        // ============================================================
        // DT30 — Validaciones cruzadas de coherencia
        // ============================================================

        // 11. fechaDesde <= fechaHasta
        if (value.fechaDesde && value.fechaHasta) {
            const desde = new Date(value.fechaDesde);
            const hasta = new Date(value.fechaHasta);
            if (desde > hasta) {
                return helpers.error('any.custom', {
                    message: 'fechaDesde cannot be after fechaHasta'
                });
            }
        }

        // 12. Si tipoPago=2 → fechaLimitePago obligatoria
        if (Number(value.tipoPago) === 2 && !value.fechaLimitePago) {
            return helpers.error('any.custom', {
                message: 'fechaLimitePago is required when tipoPago=2 (Crédito)'
            });
        }

        // 13. Si tipoPago != 2 → fechaLimitePago prohibida
        if (value.tipoPago !== undefined && Number(value.tipoPago) !== 2 && value.fechaLimitePago) {
            return helpers.error('any.custom', {
                message: 'fechaLimitePago can only be set when tipoPago=2'
            });
        }

        // 14. tipoMoneda no puede ser DOP
        if (value.tipoMoneda && String(value.tipoMoneda).toUpperCase() === 'DOP') {
            return helpers.error('any.custom', {
                message: 'tipoMoneda cannot be DOP (the local currency is implicit, omit the field)'
            });
        }

        // 15. Si tipoMoneda viene → tipoCambio obligatorio
        if (value.tipoMoneda && !value.tipoCambio) {
            return helpers.error('any.custom', {
                message: 'tipoCambio is required when tipoMoneda is provided'
            });
        }

        // 16. Tipo 46 (Exportación): receiverPais obligatorio
        if (value.type === '46' && !value.receiverPais) {
            return helpers.error('any.custom', {
                message: 'Type 46 (Exportación) requires receiverPais'
            });
        }

        // DT32 — numeroSubtotal único dentro del array
        if (value.subtotales && value.subtotales.length > 0) {
            // (a) numeroSubtotal único
            const numeros = value.subtotales.map(s => s.numeroSubtotal);
            if (new Set(numeros).size !== numeros.length) {
                return helpers.error('any.custom', {
                    message: 'subtotales: numeroSubtotal debe ser único dentro del array'
                });
            }

            // (b) Cada subtotalId usado en items debe existir en subtotales[]
            const subtotalIdsDeclarados = new Set(numeros);
            const subtotalIdsUsados = new Set();

            for (let i = 0; i < value.items.length; i++) {
                const sid = value.items[i].subtotalId;
                if (sid !== undefined && sid !== null) {
                    if (!subtotalIdsDeclarados.has(sid)) {
                        return helpers.error('any.custom', {
                            message: `Item ${i + 1}: subtotalId=${sid} no está declarado en subtotales[]. Agrega { numeroSubtotal: ${sid} } o quita el subtotalId de la línea.`
                        });
                    }
                    subtotalIdsUsados.add(sid);
                }
            }

            // (c) Cada subtotal declarado debe tener al menos una línea
            for (const n of numeros) {
                if (!subtotalIdsUsados.has(n)) {
                    return helpers.error('any.custom', {
                        message: `subtotales: numeroSubtotal=${n} no tiene ninguna línea asignada. Asigna al menos un item con subtotalId=${n}.`
                    });
                }
            }
        }

        // (d) Si algún item tiene subtotalId pero no se mandó subtotales[]
        if (!value.subtotales || value.subtotales.length === 0) {
            for (let i = 0; i < value.items.length; i++) {
                const sid = value.items[i].subtotalId;
                if (sid !== undefined && sid !== null) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: tiene subtotalId=${sid} pero no se envió el array subtotales[]. Si quieres subtotales, declara los grupos; si no, quita el subtotalId de las líneas.`
                    });
                }
            }
        }

        // ============================================================
        // DT33 — Validaciones cruzadas de descuentos/recargos globales
        // ============================================================

        // 1. numeroLinea único dentro del array
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
            const numeros = value.descuentosORecargos.map(d => d.numeroLinea);
            const unicos = new Set(numeros);
            if (unicos.size !== numeros.length) {
                return helpers.error('any.custom', {
                    message: 'descuentosORecargos: numeroLinea debe ser único dentro del array'
                });
            }
        }

        // 2. Tipos que NO admiten descuentos/recargos globales: 43 y 47
        //    (el PDF dice 0 = No aplica)
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
            if (value.type === '43' || value.type === '47') {
                return helpers.error('any.custom', {
                    message: `Type ${value.type} does not allow descuentosORecargos (global discounts/charges)`
                });
            }
        }

        // 3. indicadorNorma1007 solo aplica a descuentos (tipoAjuste = D), no a recargos (R)
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
            for (let i = 0; i < value.descuentosORecargos.length; i++) {
                const d = value.descuentosORecargos[i];
                if (d.indicadorNorma1007 === 1 && d.tipoAjuste !== 'D') {
                    return helpers.error('any.custom', {
                        message: `descuentosORecargos[${i}]: indicadorNorma1007 only applies to descuentos (tipoAjuste="D"), not recargos (tipoAjuste="R")`
                    });
                }
            }
        }

        // 4. Regla del PDF: si en <Detalle> hay ítems con distintos
        //    códigos de impuesto, el tipoValor del descuento/recargo
        //    DEBE ser "%" (porcentaje). Si es "$" con distintos
        //    indicadores, DGII rechaza.
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0 && value.items) {
            const indicadoresEnItems = new Set(
                value.items.map(it => Number(it.indicadorFacturacion ?? 4))
            );
            const hayMultiplesIndicadores = indicadoresEnItems.size > 1;

            if (hayMultiplesIndicadores) {
                for (let i = 0; i < value.descuentosORecargos.length; i++) {
                    const d = value.descuentosORecargos[i];
                    if (d.tipoValor === '$') {
                        return helpers.error('any.custom', {
                            message: `descuentosORecargos[${i}]: cuando hay ítems con distintos indicadores de facturación, tipoValor debe ser "%" (porcentaje), no "$"`
                        });
                    }
                }
            }
        }

        // 5. Coherencia: si el descuento/recargo aplica a varios
        //    indicadores de facturación, debe haber una línea por
        //    cada indicador afectado (regla del PDF D.9).
        //    Solo lo validamos si el usuario declaró el afectado
        //    como "todos" mediante múltiples líneas; no podemos
        //    inferir automáticamente qué afecta cada línea sin más
        //    metadata, así que esta regla se delega al service
        //    (que sí sabe qué base corresponde a cada indicador).
        //    Aquí solo validamos que no haya duplicados exactos
        //    (mismo numeroLinea ya cubierto arriba).



        return value;
    })
    .messages({
        'any.custom': '{{#message}}'
    });

// ============================================================
// Schema: editar factura (company_admin)
// Solo si status === 'draft'. Los campos de referencia NO son editables.
// ============================================================

const updateInvoiceSchema = Joi.object({
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
    items: Joi.array()
        .items(itemSchema)
        .min(1)
        .max(100)
        .optional()
        .messages({
            'array.min': 'If items are provided, at least one is required',
            'array.max': 'Invoice cannot have more than 100 items'
        }),

    // Campos editables de Notas (33/34)
    modificationCode: Joi.number().integer().min(1).max(5).optional()
        .messages({
            'number.min': 'CodigoModificacion must be between 1 and 5',
            'number.max': 'CodigoModificacion must be between 1 and 5'
        }),
    modificationReason: Joi.string().max(90).optional().allow(null, '')
        .messages({
            'string.max': 'Modification reason cannot exceed 90 characters'
        }),

    // ============================================================
    // DT30 — Campos editables (todos opcionales en update)
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

    codigoVendedor: emisorExtrasSchema.extract('codigoVendedor'),
    numeroFacturaInterna: emisorExtrasSchema.extract('numeroFacturaInterna'),
    numeroPedidoInterno: emisorExtrasSchema.extract('numeroPedidoInterno'),
    zonaVenta: emisorExtrasSchema.extract('zonaVenta'),
    rutaVenta: emisorExtrasSchema.extract('rutaVenta'),
    informacionAdicionalEmisor: emisorExtrasSchema.extract('informacionAdicionalEmisor'),

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

    numeroReferencia: infoAdicionalExtrasSchema.extract('numeroReferencia'),
    pesoBruto: infoAdicionalExtrasSchema.extract('pesoBruto'),
    pesoNeto: infoAdicionalExtrasSchema.extract('pesoNeto'),
    unidadPesoBruto: infoAdicionalExtrasSchema.extract('unidadPesoBruto'),
    unidadPesoNeto: infoAdicionalExtrasSchema.extract('unidadPesoNeto'),
    cantidadBulto: infoAdicionalExtrasSchema.extract('cantidadBulto'),
    unidadBulto: infoAdicionalExtrasSchema.extract('unidadBulto'),
    volumenBulto: infoAdicionalExtrasSchema.extract('volumenBulto'),
    unidadVolumen: infoAdicionalExtrasSchema.extract('unidadVolumen'),

    montoImpuestoAdicional: totalesExtrasSchema.extract('montoImpuestoAdicional'),
    impuestosAdicionales: totalesExtrasSchema.extract('impuestosAdicionales'),
    montoNoFacturable: totalesExtrasSchema.extract('montoNoFacturable'),
    montoPeriodo: totalesExtrasSchema.extract('montoPeriodo'),
    saldoAnterior: totalesExtrasSchema.extract('saldoAnterior'),
    montoAvancePago: totalesExtrasSchema.extract('montoAvancePago'),
    valorPagar: totalesExtrasSchema.extract('valorPagar'),
    totalItbisPercepcion: totalesExtrasSchema.extract('totalItbisPercepcion'),
    totalIsrPercepcion: totalesExtrasSchema.extract('totalIsrPercepcion'),

    tipoMoneda: otraMonedaSchema.extract('tipoMoneda'),
    tipoCambio: otraMonedaSchema.extract('tipoCambio'),
    montoGravadoTotalOtraMoneda: otraMonedaSchema.extract('montoGravadoTotalOtraMoneda'),
    montoGravado1OtraMoneda: otraMonedaSchema.extract('montoGravado1OtraMoneda'),
    montoGravado2OtraMoneda: otraMonedaSchema.extract('montoGravado2OtraMoneda'),
    montoGravado3OtraMoneda: otraMonedaSchema.extract('montoGravado3OtraMoneda'),
    montoExentoOtraMoneda: otraMonedaSchema.extract('montoExentoOtraMoneda'),
    totalItbisOtraMoneda: otraMonedaSchema.extract('totalItbisOtraMoneda'),
    totalItbis1OtraMoneda: otraMonedaSchema.extract('totalItbis1OtraMoneda'),
    totalItbis2OtraMoneda: otraMonedaSchema.extract('totalItbis2OtraMoneda'),
    totalItbis3OtraMoneda: otraMonedaSchema.extract('totalItbis3OtraMoneda'),
    montoImpuestoAdicionalOtraMoneda: otraMonedaSchema.extract('montoImpuestoAdicionalOtraMoneda'),
    impuestosAdicionalesOtraMoneda: otraMonedaSchema.extract('impuestosAdicionalesOtraMoneda'),
    montoTotalOtraMoneda: otraMonedaSchema.extract('montoTotalOtraMoneda'),

    // Campos NO editables nunca
    modifiedNcf: Joi.forbidden().messages({ 'any.unknown': 'NCFModificado cannot be changed after creation' }),
    modifiedNcfIssuerRnc: Joi.forbidden().messages({ 'any.unknown': 'RNCOtroContribuyente cannot be changed after creation' }),
    modifiedNcfDate: Joi.forbidden().messages({ 'any.unknown': 'FechaNCFModificado cannot be changed after creation' }),
    indicadorNotaCredito: Joi.forbidden().messages({ 'any.unknown': 'IndicadorNotaCredito cannot be changed after creation' }),

    // Campos de tipo / extranjero / transporte: NO editables
    type: Joi.forbidden(),
    receiverIdentificadorExtranjero: Joi.forbidden(),
    receiverPais: Joi.forbidden(),
    transporte: Joi.forbidden(),
    informacionesAdicionales: Joi.forbidden(),
    exemptAmount: Joi.forbidden(),
    itbis3Base: Joi.forbidden(),
    itbis3Amount: Joi.forbidden(),
    totalItbisRetenido: Joi.forbidden(),
    totalIsrRetencion: Joi.forbidden()
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required to update'
    })
    .custom((value, helpers) => {
        // 1. issuedAt: no futuro, no más de 30 días atrás
        if (value.issuedAt) {
            const issuedAt = new Date(value.issuedAt);
            const now = new Date();
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            if (issuedAt > now) {
                return helpers.error('any.custom', { message: 'issuedAt cannot be in the future' });
            }
            if (issuedAt < thirtyDaysAgo) {
                return helpers.error('any.custom', { message: 'issuedAt cannot be more than 30 days in the past' });
            }
        }

        // 2. Por línea: coherencia indicador ↔ itbisRate + discount
        if (value.items) {
            const expectedRates = { 0: 0, 1: 18, 2: 16, 3: 0, 4: 0 };

            for (let i = 0; i < value.items.length; i++) {
                const item = value.items[i];

                let indicador = item.indicadorFacturacion;
                if (indicador === undefined) {
                    if (item.itbisRate === 18) indicador = 1;
                    else if (item.itbisRate === 16) indicador = 2;
                    else if (item.itbisRate === 0) indicador = 4;
                    else indicador = 4;
                }

                const expectedRate = expectedRates[indicador];
                if (item.itbisRate !== undefined && Number(item.itbisRate) !== expectedRate) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: itbisRate (${item.itbisRate}) no coincide con indicadorFacturacion=${indicador} (esperado ${expectedRate}). Usa 1=18%, 2=16%, 3=0% gravado, 4=exento.`
                    });
                }

                const lineBase = (item.quantity * item.unitPrice) - item.discount;
                if (lineBase < 0) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: discount cannot exceed (quantity × unitPrice)`
                    });
                }
            }
        }

        // 3. Retención por línea: solo 41/47 (validación de indicador)
        if (value.items) {
            for (let i = 0; i < value.items.length; i++) {
                const ret = value.items[i].retencion;
                if (ret !== undefined && ret !== null) {
                    if (ret.indicador !== 1 && ret.indicador !== 2) {
                        return helpers.error('any.custom', {
                            message: `Item ${i + 1}: retencion.indicador must be 1 (Retención) or 2 (Percepción)`
                        });
                    }
                }
            }
        }

        // 4. Reglas cruzadas DGII del <Item> (Step 4)
        if (value.items) {
            for (let i = 0; i < value.items.length; i++) {
                const item = value.items[i];
                const indicadorBienoServicio = item.indicadorBienoServicio ?? 1;

                // (1) Bien requiere unidadMedida
                if (indicadorBienoServicio === 1) {
                    if (item.unidadMedida === undefined || item.unidadMedida === null) {
                        return helpers.error('any.custom', {
                            message: `Item ${i + 1}: unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.`
                        });
                    }
                }

                // (2) cantidadReferencia ↔ unidadReferencia
                const hasCantRef = item.cantidadReferencia !== undefined && item.cantidadReferencia !== null;
                const hasUniRef = item.unidadReferencia !== undefined && item.unidadReferencia !== null;
                if (hasCantRef && !hasUniRef) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: unidadReferencia is required when cantidadReferencia is provided`
                    });
                }
                if (hasUniRef && !hasCantRef) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: cantidadReferencia is required when unidadReferencia is provided`
                    });
                }

                // (3) fechaVencimientoItem >= fechaElaboracion
                if (item.fechaElaboracion && item.fechaVencimientoItem) {
                    const elab = new Date(item.fechaElaboracion);
                    const venc = new Date(item.fechaVencimientoItem);
                    if (venc < elab) {
                        return helpers.error('any.custom', {
                            message: `Item ${i + 1}: fechaVencimientoItem (${item.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${item.fechaElaboracion})`
                        });
                    }
                }

                // (4) gradosAlcohol solo en bienes
                if (indicadorBienoServicio === 2
                    && item.gradosAlcohol !== undefined
                    && item.gradosAlcohol !== null) {
                    return helpers.error('any.custom', {
                        message: `Item ${i + 1}: gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios`
                    });
                }
            }
        }

        // ============================================================
        // DT30 — Validaciones cruzadas de coherencia
        // ============================================================

        // 5. fechaDesde <= fechaHasta
        if (value.fechaDesde && value.fechaHasta) {
            const desde = new Date(value.fechaDesde);
            const hasta = new Date(value.fechaHasta);
            if (desde > hasta) {
                return helpers.error('any.custom', {
                    message: 'fechaDesde cannot be after fechaHasta'
                });
            }
        }

        // 6. tipoMoneda no puede ser DOP
        if (value.tipoMoneda && String(value.tipoMoneda).toUpperCase() === 'DOP') {
            return helpers.error('any.custom', {
                message: 'tipoMoneda cannot be DOP (the local currency is implicit, omit the field)'
            });
        }

        // ============================================================
        // DT32 — Validaciones de subtotales (update)
        //
        // En update, `items` puede no venir en el body (se usan los
        // de BD). Por eso aquí SOLO validamos:
        //   - numeroSubtotal único
        //   - Coherencia subtotalId ↔ subtotales si AMBOS vienen
        //
        // La validación de "cada subtotal tiene líneas" y "cada
        // subtotalId existe" se completa en el SERVICE, que sí
        // conoce las líneas finales (vengan del body o de BD).
        // ============================================================
        if (value.subtotales && value.subtotales.length > 0) {
            const numeros = value.subtotales.map(s => s.numeroSubtotal);
            if (new Set(numeros).size !== numeros.length) {
                return helpers.error('any.custom', {
                    message: 'subtotales: numeroSubtotal debe ser único dentro del array'
                });
            }

            // Si también vienen items, validar subtotalIds huérfanos
            if (value.items) {
                const subtotalIdsDeclarados = new Set(numeros);
                for (let i = 0; i < value.items.length; i++) {
                    const sid = value.items[i].subtotalId;
                    if (sid !== undefined && sid !== null && !subtotalIdsDeclarados.has(sid)) {
                        return helpers.error('any.custom', {
                            message: `Item ${i + 1}: subtotalId=${sid} no está declarado en subtotales[]`
                        });
                    }
                }
            }
        }

        // Si algún item tiene subtotalId pero no se manda subtotales[],
        // es válido en update (los subtotales existentes se conservan o
        // el service recalcula). Solo validamos si el cliente intenta
        // usar un subtotalId sin declararlo Y sin que existan subtotales
        // previos — eso lo resuelve el service.


        
        // ============================================================
        // DT33 — Validaciones cruzadas de descuentos/recargos globales
        // (mismas que en create, pero sin poder validar contra el
        // tipo real porque en update no viene en el body)
        // ============================================================

        // 1. numeroLinea único dentro del array
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
            const numeros = value.descuentosORecargos.map(d => d.numeroLinea);
            const unicos = new Set(numeros);
            if (unicos.size !== numeros.length) {
                return helpers.error('any.custom', {
                    message: 'descuentosORecargos: numeroLinea debe ser único dentro del array'
                });
            }
        }

        // 2. indicadorNorma1007 solo aplica a descuentos (tipoAjuste = D)
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0) {
            for (let i = 0; i < value.descuentosORecargos.length; i++) {
                const d = value.descuentosORecargos[i];
                if (d.indicadorNorma1007 === 1 && d.tipoAjuste !== 'D') {
                    return helpers.error('any.custom', {
                        message: `descuentosORecargos[${i}]: indicadorNorma1007 only applies to descuentos (tipoAjuste="D"), not recargos (tipoAjuste="R")`
                    });
                }
            }
        }

        // 3. Regla del PDF: si hay ítems con distintos indicadores
        //    de facturación, tipoValor debe ser "%"
        if (value.descuentosORecargos && value.descuentosORecargos.length > 0 && value.items) {
            const indicadoresEnItems = new Set(
                value.items.map(it => Number(it.indicadorFacturacion ?? 4))
            );
            const hayMultiplesIndicadores = indicadoresEnItems.size > 1;

            if (hayMultiplesIndicadores) {
                for (let i = 0; i < value.descuentosORecargos.length; i++) {
                    const d = value.descuentosORecargos[i];
                    if (d.tipoValor === '$') {
                        return helpers.error('any.custom', {
                            message: `descuentosORecargos[${i}]: cuando hay ítems con distintos indicadores de facturación, tipoValor debe ser "%" (porcentaje), no "$"`
                        });
                    }
                }
            }
        }

        return value;
    })
    .messages({
        'any.custom': '{{#message}}'
    });

// ============================================================
// Schema: descargar PDF
// ============================================================
const downloadPDFQuerySchema = Joi.object({
    format: Joi.string()
        .valid('a4', 'ticket', 'half')
        .optional()
        .default('a4')
        .messages({
            'any.only': 'format must be one of: a4, ticket, half'
        })
});

// ============================================================
// Schema: descargar XML
// ============================================================
const downloadXMLQuerySchema = Joi.object({
    type: Joi.string()
        .valid('signed', 'unsigned')
        .optional()
        .default('unsigned')
        .messages({
            'any.only': 'type must be one of: signed, unsigned'
        })
});

module.exports = {
    listInvoicesQuerySchema,
    createInvoiceSchema,
    updateInvoiceSchema,
    listAllInvoicesQuerySchema,
    downloadPDFQuerySchema,
    downloadXMLQuerySchema,
    // DT30 — Sub-schemas reutilizables
    idDocExtrasSchema,
    emisorExtrasSchema,
    compradorExtrasSchema,
    infoAdicionalExtrasSchema,
    totalesExtrasSchema,
    otraMonedaSchema,
    // DT32 — Subtotales
    subtotalSchema,
    // DT33 — Descuentos o recargos globales
    descuentoORecargoSchema
};