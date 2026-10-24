const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceLine = sequelize.define('InvoiceLine', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    invoiceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'invoice_id'
    },
    lineNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'line_number',
        validate: {
            min: {
                args: [1],
                msg: 'Line number must be greater than 0'
            }
        }
    },

    // ============================================================
    // IDENTIFICACIÓN DEL ÍTEM
    // ============================================================
    itemCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'item_code'
    },
    itemName: {
        // NombreItem: OBLIGATORIO DGII, máx 80 chars
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'item_name',
        validate: {
            notEmpty: { msg: 'Item name is required' },
            len: { args: [1, 80], msg: 'Item name must be 1-80 chars' }
        }
    },
    description: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        validate: {
            len: {
                args: [0, 1000],
                msg: 'Description must be between 0 and 1000 characters'
            }
        }
    },

    // ============================================================
    // NATURALEZA DEL ÍTEM (crítico para DGII)
    // ============================================================
    indicadorBienoServicio: {
        // 1 = Bien, 2 = Servicio → OBLIGATORIO en DGII
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
        field: 'indicador_bieno_servicio',
        validate: {
            isIn: {
                args: [[1, 2]],
                msg: 'IndicadorBienoServicio must be 1 (Bien) or 2 (Servicio)'
            }
        }
    },

    unidadMedida: {
        // Código DGII 1-62. NULL = no se envía (válido para servicios)
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'unidad_medida',
        validate: {
            min: { args: [1], msg: 'UnidadMedida must be 1-62' },
            max: { args: [62], msg: 'UnidadMedida must be 1-62' }
        }
    },

    // ============================================================
    // CANTIDADES Y PRECIOS
    // ============================================================
    quantity: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false,
        validate: {
            min: {
                args: [0.0001],
                msg: 'Quantity must be greater than 0'
            }
        }
    },
    unitPrice: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false,
        field: 'unit_price',
        validate: {
            min: {
                args: [0],
                msg: 'Unit price cannot be negative'
            }
        }
    },

    // ============================================================
    // REFERENCIAS OPCIONALES (alimentos, licores, minería, etc.)
    // ============================================================
    cantidadReferencia: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
        field: 'cantidad_referencia',
        validate: {
            min: { args: [0], msg: 'Cantidad referencia cannot be negative' }
        }
    },
    unidadReferencia: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'unidad_referencia',
        validate: {
            min: { args: [1], msg: 'Unidad referencia must be 1-62' },
            max: { args: [62], msg: 'Unidad referencia must be 1-62' }
        }
    },
    gradosAlcohol: {
        // Solo licores (no escribir en otros ítems)
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: 'grados_alcohol',
        validate: {
            min: { args: [0], msg: 'Grados alcohol cannot be negative' },
            max: { args: [100], msg: 'Grados alcohol cannot exceed 100' }
        }
    },
    precioUnitarioReferencia: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'precio_unitario_referencia',
        validate: {
            min: { args: [0], msg: 'Precio referencia cannot be negative' }
        }
    },
    fechaElaboracion: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_elaboracion'
    },
    fechaVencimientoItem: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_vencimiento_item'
    },

    // ============================================================
    // DESCUENTOS Y RECARGOS
    // ============================================================
    discount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: {
                args: [0],
                msg: 'Discount cannot be negative'
            }
        }
    },
    recargo: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'Recargo cannot be negative' }
        }
    },

    // ============================================================
    // ITBIS
    // ============================================================
    itbisRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 18,
        field: 'itbis_rate',
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS rate cannot be negative'
            },
            max: {
                args: [100],
                msg: 'ITBIS rate cannot exceed 100'
            }
        }
    },
    itbisAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'itbis_amount',
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS amount cannot be negative'
            }
        }
    },
    indicadorFacturacion: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
        field: 'indicador_facturacion',
        validate: {
            isIn: {
                args: [[0, 1, 2, 3, 4]],
                msg: 'IndicadorFacturacion must be 0 (No Facturable), 1 (18%), 2 (16%), 3 (ITBIS 0%), or 4 (Exento)'
            }
        }
    },

    // ============================================================
    // RETENCIONES (41, 47)
    // ============================================================
    retencionIndicador: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'retencion_indicador',
        validate: {
            isIn: {
                args: [[1, 2]],
                msg: 'RetencionIndicador must be 1 (Retención) or 2 (Percepción)'
            }
        }
    },
    montoItbisRetenido: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_itbis_retenido',
        validate: {
            min: { args: [0], msg: 'Monto ITBIS retenido cannot be negative' }
        }
    },
    montoIsrRetenido: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_isr_retenido',
        validate: {
            min: { args: [0], msg: 'Monto ISR retenido cannot be negative' }
        }
    },

    // ============================================================
    // TOTAL DE LA LÍNEA
    // ============================================================
    total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Line total cannot be negative'
            }
        }
    }
}, {
    tableName: 'invoice_lines',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['invoice_id'], name: 'idx_invoice_lines_invoice_id' },
        { fields: ['item_code'], name: 'idx_invoice_lines_item_code' },
        { fields: ['indicador_bieno_servicio'], name: 'idx_invoice_lines_bieno_servicio' },
        { fields: ['invoice_id', 'line_number'], unique: true, name: 'uq_invoice_lines_invoice_line' }
    ]
});

// ------------------------------------------------------------
// Helpers estáticos: traducir indicador ↔ tasa
// ------------------------------------------------------------

/**
 * Devuelve la tasa ITBIS (0, 16, 18) a partir del IndicadorFacturacion DGII.
 *   0 → no facturable (regalo/bono) → tasa 0
 *   1 → ITBIS 18%
 *   2 → ITBIS 16%
 *   3 → ITBIS 3 (0%) → tasa 0 (venta gravada a 0%, ej exportación)
 *   4 → Exento       → tasa 0 (no sujeto a ITBIS)
 */
InvoiceLine.getRateFromIndicador = function (indicador) {
    const n = Number(indicador);
    if (n === 1) return 18;
    if (n === 2) return 16;
    return 0; // 0, 3 y 4 → tasa 0
};

/**
 * Infiere el IndicadorFacturacion a partir de la tasa ITBIS.
 * Se usa SOLO para backward-compat cuando el cliente no manda
 * indicadorFacturacion explícito. Reglas:
 *   18  → 1
 *   16  → 2
 *   0   → 4 (exento, el caso más común en RD cuando alguien manda 0)
 *   otro → 4 (fallback seguro)
 */
InvoiceLine.getIndicadorFromRate = function (rate) {
    const n = Number(rate);
    if (n === 18) return 1;
    if (n === 16) return 2;
    return 4; // 0 y cualquier otra tasa desconocida → exento
};

module.exports = InvoiceLine;