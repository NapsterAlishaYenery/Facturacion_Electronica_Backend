const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
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
    // 🔥 NUEVO: comprador extranjero (46, 47)
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
    subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Subtotal cannot be negative'
            }
        }
    },
    itbis: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS cannot be negative'
            }
        }
    },
    // 🔥 NUEVO: monto exento (43, 44, 47)
    exemptAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'exempt_amount',
        validate: {
            min: {
                args: [0],
                msg: 'Exempt amount cannot be negative'
            }
        }
    },
    // 🔥 NUEVO: ITBIS3 (46 — exportación)
    itbis3Base: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'itbis3_base',
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS3 base cannot be negative'
            }
        }
    },
    itbis3Amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'itbis3_amount',
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS3 amount cannot be negative'
            }
        }
    },
    // 🔥 NUEVO: retención a nivel encabezado (41, 47)
    totalItbisRetenido: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_itbis_retenido',
        validate: {
            min: {
                args: [0],
                msg: 'Total ITBIS retenido cannot be negative'
            }
        }
    },
    totalIsrRetencion: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'total_isr_retencion',
        validate: {
            min: {
                args: [0],
                msg: 'Total ISR retención cannot be negative'
            }
        }
    },
    total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Total cannot be negative'
            }
        }
    },
    issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'issued_at'
    },

    // 🔥 NUEVO: bloque <Transporte> (31-34, 44-47)
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

    // 🔥 NUEVO: <InformacionesAdicionales> extendido (46)
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

    // 🔥 Campos específicos de Notas de Débito/Crédito (33/34)
    modifiedNcf: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'modified_ncf',
        validate: {
            len: {
                args: [11, 19],
                msg: 'Modified NCF must be between 11 and 19 characters'
            }
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
            min: {
                args: [1],
                msg: 'Modification code must be between 1 and 5'
            },
            max: {
                args: [5],
                msg: 'Modification code must be between 1 and 5'
            }
        }
    },
    modificationReason: {
        type: DataTypes.STRING(90),
        allowNull: true,
        field: 'modification_reason',
        validate: {
            len: {
                args: [0, 90],
                msg: 'Modification reason cannot exceed 90 characters'
            }
        }
    },
    indicadorNotaCredito: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_nota_credito',
        validate: {
            isIn: {
                args: [[0, 1]],
                msg: 'IndicadorNotaCredito must be 0 or 1'
            }
        }
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