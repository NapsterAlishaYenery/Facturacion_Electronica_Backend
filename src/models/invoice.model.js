const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
    // ============================================================
    // METADATOS DEL SISTEMA
    // ============================================================
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id'
    },
    sequenceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sequence_id'
    },
    type: {
        type: DataTypes.STRING(2),
        allowNull: false,
        validate: {
            isIn: {
                args: [['31', '32', '33', '34', '41', '43', '44', '45', '46', '47']],
                msg: 'Invalid e-CF type'
            }
        }
    },
    ncf: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'NCF is required' }
        }
    },
    trackId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'track_id'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency']],
                msg: 'Invalid invoice status'
            }
        }
    },
    xmlContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'xml_content'
    },
    xmlSigned: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'xml_signed'
    },
    dgiiResponse: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'dgii_response'
    },
    sendAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'send_attempts',
        validate: {
            min: { args: [0], msg: 'send_attempts cannot be negative' }
        }
    },

    // ============================================================
    // SECCIÓN 1 — ENCABEZADO
    // ============================================================

    // ------------------------------------------------------------
    // 1.1 — <IdDoc>
    // ------------------------------------------------------------
    indicadorNotaCredito: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_nota_credito',
        validate: {
            isIn: { args: [[0, 1]], msg: 'IndicadorNotaCredito must be 0 or 1' }
        }
    },
    indicadorEnvioDiferido: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_envio_diferido',
        validate: {
            isIn: { args: [[0, 1]], msg: 'indicadorEnvioDiferido must be 0 or 1' }
        }
    },
    indicadorMontoGravado: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_monto_gravado',
        validate: {
            isIn: { args: [[0, 1]], msg: 'indicadorMontoGravado must be 0 or 1' }
        }
    },
    indicadorServicioTodoIncluido: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_servicio_todo_incluido',
        validate: {
            isIn: { args: [[0, 1]], msg: 'indicadorServicioTodoIncluido must be 0 or 1' }
        }
    },
    tipoIngresos: {
        type: DataTypes.STRING(2),
        allowNull: true,
        field: 'tipo_ingresos',
        validate: {
            isIn: {
                args: [['01', '02', '03', '04', '05', '06']],
                msg: 'tipoIngresos must be 01-06'
            }
        }
    },
    tipoPago: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'tipo_pago',
        validate: {
            isIn: { args: [[1, 2, 3]], msg: 'tipoPago must be 1, 2 or 3' }
        }
    },
    fechaLimitePago: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_limite_pago'
    },
    terminoPago: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'termino_pago',
        validate: {
            len: { args: [0, 15], msg: 'terminoPago cannot exceed 15 characters' }
        }
    },
    formasPago: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'formas_pago'
    },
    tipoCuentaPago: {
        type: DataTypes.STRING(2),
        allowNull: true,
        field: 'tipo_cuenta_pago',
        validate: {
            isIn: { args: [['CT', 'AH', 'OT']], msg: 'tipoCuentaPago must be CT, AH or OT' }
        }
    },
    numeroCuentaPago: {
        type: DataTypes.STRING(28),
        allowNull: true,
        field: 'numero_cuenta_pago',
        validate: {
            len: { args: [0, 28], msg: 'numeroCuentaPago cannot exceed 28 characters' }
        }
    },
    bancoPago: {
        type: DataTypes.STRING(75),
        allowNull: true,
        field: 'banco_pago',
        validate: {
            len: { args: [0, 75], msg: 'bancoPago cannot exceed 75 characters' }
        }
    },
    fechaDesde: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_desde'
    },
    fechaHasta: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_hasta'
    },
    totalPaginas: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'total_paginas',
        validate: {
            min: { args: [1], msg: 'totalPaginas must be >= 1' }
        }
    },

    // ------------------------------------------------------------
    // 1.2 — <Emisor> (los de la factura, no de Company)
    // ------------------------------------------------------------
    codigoVendedor: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'codigo_vendedor',
        validate: {
            len: { args: [0, 60], msg: 'codigoVendedor cannot exceed 60 characters' }
        }
    },
    numeroFacturaInterna: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'numero_factura_interna',
        validate: {
            len: { args: [0, 20], msg: 'numeroFacturaInterna cannot exceed 20 characters' }
        }
    },
    numeroPedidoInterno: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'numero_pedido_interno',
        validate: {
            len: { args: [0, 20], msg: 'numeroPedidoInterno cannot exceed 20 characters' }
        }
    },
    zonaVenta: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'zona_venta',
        validate: {
            len: { args: [0, 20], msg: 'zonaVenta cannot exceed 20 characters' }
        }
    },
    rutaVenta: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'ruta_venta',
        validate: {
            len: { args: [0, 20], msg: 'rutaVenta cannot exceed 20 characters' }
        }
    },
    informacionAdicionalEmisor: {
        type: DataTypes.STRING(250),
        allowNull: true,
        field: 'informacion_adicional_emisor',
        validate: {
            len: { args: [0, 250], msg: 'informacionAdicionalEmisor cannot exceed 250 characters' }
        }
    },

    // ------------------------------------------------------------
    // 1.3 — <Comprador>
    // ------------------------------------------------------------
    receiverRnc: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'receiver_rnc'
    },
    receiverName: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'receiver_name'
    },
    receiverIdentificadorExtranjero: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'receiver_identificador_extranjero'
    },
    receiverPais: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'receiver_pais'
    },
    contactoComprador: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'contacto_comprador',
        validate: {
            len: { args: [0, 80], msg: 'contactoComprador cannot exceed 80 characters' }
        }
    },
    correoComprador: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'correo_comprador',
        validate: {
            isValidEmail(value) {
                if (!value) return;
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!re.test(value)) throw new Error('correoComprador must be a valid email');
            }
        }
    },
    direccionComprador: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'direccion_comprador',
        validate: {
            len: { args: [0, 100], msg: 'direccionComprador cannot exceed 100 characters' }
        }
    },
    municipioComprador: {
        type: DataTypes.STRING(6),
        allowNull: true,
        field: 'municipio_comprador',
        validate: {
            is: { args: /^\d{6}$/, msg: 'municipioComprador must be 6 digits (Tabla III)' }
        }
    },
    provinciaComprador: {
        type: DataTypes.STRING(6),
        allowNull: true,
        field: 'provincia_comprador',
        validate: {
            is: { args: /^\d{6}$/, msg: 'provinciaComprador must be 6 digits (Tabla III)' }
        }
    },
    fechaEntrega: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_entrega'
    },
    contactoEntrega: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'contacto_entrega',
        validate: {
            len: { args: [0, 100], msg: 'contactoEntrega cannot exceed 100 characters' }
        }
    },
    direccionEntrega: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'direccion_entrega',
        validate: {
            len: { args: [0, 100], msg: 'direccionEntrega cannot exceed 100 characters' }
        }
    },
    telefonoAdicional: {
        type: DataTypes.STRING(12),
        allowNull: true,
        field: 'telefono_adicional',
        validate: {
            is: {
                args: /^\d{3}-\d{3}-\d{4}$/,
                msg: 'telefonoAdicional must have format xxx-xxx-xxxx'
            }
        }
    },
    fechaOrdenCompra: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_orden_compra'
    },
    numeroOrdenCompra: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'numero_orden_compra',
        validate: {
            len: { args: [0, 20], msg: 'numeroOrdenCompra cannot exceed 20 characters' }
        }
    },
    codigoInternoComprador: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'codigo_interno_comprador',
        validate: {
            len: { args: [0, 20], msg: 'codigoInternoComprador cannot exceed 20 characters' }
        }
    },
    responsablePago: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'responsable_pago',
        validate: {
            len: { args: [0, 20], msg: 'responsablePago cannot exceed 20 characters' }
        }
    },
    informacionAdicionalComprador: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'informacion_adicional_comprador',
        validate: {
            len: { args: [0, 150], msg: 'informacionAdicionalComprador cannot exceed 150 characters' }
        }
    },

    // ------------------------------------------------------------
    // 1.4 — <InformacionesAdicionales>
    // ------------------------------------------------------------
    infoFechaEmbarque: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'info_fecha_embarque'
    },
    infoNumeroEmbarque: {
        type: DataTypes.STRING(25),
        allowNull: true,
        field: 'info_numero_embarque'
    },
    infoNumeroContenedor: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'info_numero_contenedor'
    },
    infoNumeroReferencia: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'info_numero_referencia',
        validate: {
            len: { args: [0, 20], msg: 'infoNumeroReferencia cannot exceed 20 characters' }
        }
    },
    infoNombrePuertoEmbarque: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'info_nombre_puerto_embarque'
    },
    infoCondicionesEntrega: {
        type: DataTypes.STRING(3),
        allowNull: true,
        field: 'info_condiciones_entrega'
    },
    infoTotalFob: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_total_fob'
    },
    infoSeguro: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_seguro'
    },
    infoFlete: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_flete'
    },
    infoOtrosGastos: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_otros_gastos'
    },
    infoTotalCif: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_total_cif'
    },
    infoRegimenAduanero: {
        type: DataTypes.STRING(35),
        allowNull: true,
        field: 'info_regimen_aduanero'
    },
    infoNombrePuertoSalida: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'info_nombre_puerto_salida'
    },
    infoNombrePuertoDesembarque: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: 'info_nombre_puerto_desembarque'
    },
    infoPesoBruto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_peso_bruto'
    },
    infoPesoNeto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_peso_neto'
    },
    infoUnidadPesoBruto: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'info_unidad_peso_bruto',
        validate: {
            min: { args: [1], msg: 'infoUnidadPesoBruto must be 1-62' },
            max: { args: [62], msg: 'infoUnidadPesoBruto must be 1-62' }
        }
    },
    infoUnidadPesoNeto: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'info_unidad_peso_neto',
        validate: {
            min: { args: [1], msg: 'infoUnidadPesoNeto must be 1-62' },
            max: { args: [62], msg: 'infoUnidadPesoNeto must be 1-62' }
        }
    },
    infoCantidadBulto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_cantidad_bulto'
    },
    infoUnidadBulto: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'info_unidad_bulto',
        validate: {
            min: { args: [1], msg: 'infoUnidadBulto must be 1-62' },
            max: { args: [62], msg: 'infoUnidadBulto must be 1-62' }
        }
    },
    infoVolumenBulto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'info_volumen_bulto'
    },
    infoUnidadVolumen: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'info_unidad_volumen',
        validate: {
            min: { args: [1], msg: 'infoUnidadVolumen must be 1-62' },
            max: { args: [62], msg: 'infoUnidadVolumen must be 1-62' }
        }
    },

    // ------------------------------------------------------------
    // 1.5 — <Transporte>
    // ------------------------------------------------------------
    transporteVia: {
        type: DataTypes.STRING(2),
        allowNull: true,
        field: 'transporte_via',
        validate: {
            isIn: {
                args: [['01', '02', '03']],
                msg: 'Via de transporte must be 01 (Terrestre), 02 (Marítimo) or 03 (Aérea)'
            }
        }
    },
    transportePaisOrigen: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'transporte_pais_origen'
    },
    transporteDireccionDestino: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'transporte_direccion_destino'
    },
    transportePaisDestino: {
        type: DataTypes.STRING(60),
        allowNull: true,
        field: 'transporte_pais_destino'
    },
    transporteRncCompania: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_rnc_compania'
    },
    transporteNombreCompania: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'transporte_nombre_compania'
    },
    transporteNumeroViaje: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_numero_viaje'
    },
    transporteConductor: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_conductor'
    },
    transporteDocumento: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_documento'
    },
    transporteFicha: {
        type: DataTypes.STRING(10),
        allowNull: true,
        field: 'transporte_ficha'
    },
    transportePlaca: {
        type: DataTypes.STRING(7),
        allowNull: true,
        field: 'transporte_placa'
    },
    transporteRuta: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_ruta'
    },
    transporteZona: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_zona'
    },
    transporteNumeroAlbaran: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'transporte_numero_albaran'
    },

    // ------------------------------------------------------------
    // 1.6 — <Totales>
    // ------------------------------------------------------------
    issuerRnc: {
        type: DataTypes.STRING(15),
        allowNull: false,
        field: 'issuer_rnc',
        validate: {
            notEmpty: { msg: 'Issuer RNC is required' }
        }
    },
    issuerName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'issuer_name',
        validate: {
            notEmpty: { msg: 'Issuer name is required' }
        }
    },
    subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: { args: [0], msg: 'Subtotal cannot be negative' }
        }
    },
    itbis: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'ITBIS cannot be negative' }
        }
    },
    montoGravado: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_gravado',
        validate: {
            min: { args: [0], msg: 'Monto gravado cannot be negative' }
        }
    },
    itbis1Base: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'itbis1_base',
        validate: {
            min: { args: [0], msg: 'ITBIS1 base cannot be negative' }
        }
    },
    itbis1Amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'itbis1_amount',
        validate: {
            min: { args: [0], msg: 'ITBIS1 amount cannot be negative' }
        }
    },
    itbis2Base: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'itbis2_base',
        validate: {
            min: { args: [0], msg: 'ITBIS2 base cannot be negative' }
        }
    },
    itbis2Amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'itbis2_amount',
        validate: {
            min: { args: [0], msg: 'ITBIS2 amount cannot be negative' }
        }
    },
    exemptAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'exempt_amount',
        validate: {
            min: { args: [0], msg: 'Exempt amount cannot be negative' }
        }
    },
    itbis3Base: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'itbis3_base',
        validate: {
            min: { args: [0], msg: 'ITBIS3 base cannot be negative' }
        }
    },
    itbis3Amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'itbis3_amount',
        validate: {
            min: { args: [0], msg: 'ITBIS3 amount cannot be negative' }
        }
    },
    totalItbisRetenido: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_retenido',
        validate: {
            min: { args: [0], msg: 'Total ITBIS retenido cannot be negative' }
        }
    },
    totalIsrRetencion: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_isr_retencion',
        validate: {
            min: { args: [0], msg: 'Total ISR retención cannot be negative' }
        }
    },
    total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: { args: [0], msg: 'Total cannot be negative' }
        }
    },
    montoImpuestoAdicional: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_impuesto_adicional'
    },
    impuestosAdicionales: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'impuestos_adicionales'
    },
    montoNoFacturable: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_no_facturable'
    },
    montoPeriodo: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_periodo'
    },
    saldoAnterior: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'saldo_anterior'
    },
    montoAvancePago: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_avance_pago'
    },
    valorPagar: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'valor_pagar'
    },
    totalItbisPercepcion: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_percepcion',
        validate: {
            min: { args: [0], msg: 'totalItbisPercepcion cannot be negative' }
        }
    },
    totalIsrPercepcion: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_isr_percepcion',
        validate: {
            min: { args: [0], msg: 'totalIsrPercepcion cannot be negative' }
        }
    },

    // ------------------------------------------------------------
    // 1.7 — <OtraMoneda>
    // ------------------------------------------------------------
    tipoMoneda: {
        type: DataTypes.STRING(3),
        allowNull: true,
        field: 'tipo_moneda',
        validate: {
            len: { args: [0, 3], msg: 'tipoMoneda must be 3 chars ISO 4217' }
        }
    },
    tipoCambio: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        field: 'tipo_cambio',
        validate: {
            min: { args: [0], msg: 'tipoCambio must be > 0' }
        }
    },
    montoGravadoTotalOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_gravado_total_otra_moneda'
    },
    montoGravado1OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_gravado_1_otra_moneda'
    },
    montoGravado2OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_gravado_2_otra_moneda'
    },
    montoGravado3OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_gravado_3_otra_moneda'
    },
    montoExentoOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_exento_otra_moneda'
    },
    totalItbisOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_otra_moneda'
    },
    totalItbis1OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_1_otra_moneda'
    },
    totalItbis2OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_2_otra_moneda'
    },
    totalItbis3OtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_3_otra_moneda'
    },
    montoImpuestoAdicionalOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_impuesto_adicional_otra_moneda'
    },
    impuestosAdicionalesOtraMoneda: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'impuestos_adicionales_otra_moneda'
    },
    montoTotalOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_total_otra_moneda'
    },

    // ============================================================
    // SECCIÓN 6 — INFORMACIÓN DE REFERENCIA (33/34)
    // ============================================================
    modifiedNcf: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'modified_ncf',
        validate: {
            len: { args: [11, 19], msg: 'Modified NCF must be between 11 and 19 characters' }
        }
    },
    modifiedNcfIssuerRnc: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'modified_ncf_issuer_rnc'
    },
    modifiedNcfDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'modified_ncf_date'
    },
    modificationCode: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'modification_code',
        validate: {
            min: { args: [1], msg: 'Modification code must be between 1 and 5' },
            max: { args: [5], msg: 'Modification code must be between 1 and 5' }
        }
    },
    modificationReason: {
        type: DataTypes.STRING(90),
        allowNull: true,
        field: 'modification_reason',
        validate: {
            len: { args: [0, 90], msg: 'Modification reason cannot exceed 90 characters' }
        }
    },

    // ============================================================
    // Fecha de emisión
    // ============================================================
    issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'issued_at'
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['company_id'], name: 'idx_invoices_company_id' },
        { fields: ['sequence_id'], name: 'idx_invoices_sequence_id' },
        { fields: ['status'], name: 'idx_invoices_status' },
        { fields: ['track_id'], name: 'idx_invoices_track_id' },
        { fields: ['ncf'], name: 'idx_invoices_ncf' },
        { fields: ['issued_at'], name: 'idx_invoices_issued_at' },
        { fields: ['company_id', 'status'], name: 'idx_invoices_company_status' },
        { fields: ['company_id', 'issued_at'], name: 'idx_invoices_company_issued' },
        { fields: ['company_id', 'ncf'], unique: true, name: 'uq_invoices_company_ncf' },
        { fields: ['modified_ncf'], name: 'idx_invoices_modified_ncf' },
        { fields: ['company_id', 'type', 'modified_ncf'], name: 'idx_invoices_company_type_modified' },
        { fields: ['type', 'status'], name: 'idx_invoices_type_status' }
    ]
});

module.exports = Invoice;