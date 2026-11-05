const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ============================================================
// DT33 — InvoiceDiscountCharge
// Descuentos y recargos GLOBALES por factura (hasta 20)
// Basado en el bloque <DescuentosORecargos> del PDF DGII v1.0
// Sección D del Formato de Comprobante Fiscal Electrónico
// ============================================================

const InvoiceDiscountCharge = sequelize.define('InvoiceDiscountCharge', {
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

    // D.1 — <NumeroLinea> — secuencial 1-20
    numeroLinea: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        field: 'numero_linea',
        validate: {
            min: { args: [1], msg: 'numeroLinea must be between 1 and 20' },
            max: { args: [20], msg: 'numeroLinea must be between 1 and 20' }
        }
    },

    // D.2 — <TipoAjuste> — D (descuento) o R (recargo)
    tipoAjuste: {
        type: DataTypes.STRING(1),
        allowNull: false,
        field: 'tipo_ajuste',
        validate: {
            isIn: {
                args: [['D', 'R']],
                msg: 'tipoAjuste must be "D" (descuento) or "R" (recargo)'
            }
        }
    },

    // D.3 — <IndicadorNorma1007> — 1 si aplica norma 10-07, null si no
    indicadorNorma1007: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_norma_1007',
        validate: {
            isIn: {
                args: [[1]],
                msg: 'indicadorNorma1007 must be 1 or null'
            }
        }
    },

    // D.4 — <DescripcionDescuentooRecargo> — texto libre, máx 45 chars
    descripcion: {
        type: DataTypes.STRING(45),
        allowNull: true,
        validate: {
            len: {
                args: [0, 45],
                msg: 'DescripcionDescuentooRecargo cannot exceed 45 characters'
            }
        }
    },

    // D.5 — <TipoValor> — % o $
    tipoValor: {
        type: DataTypes.STRING(1),
        allowNull: false,
        field: 'tipo_valor',
        validate: {
            isIn: {
                args: [['%', '$']],
                msg: 'tipoValor must be "%" (porcentaje) or "$" (monto)'
            }
        }
    },

    // D.6 — <ValorDescuentooRecargo> — porcentaje (solo si tipoValor = %)
    valor: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: { args: [0], msg: 'valor cannot be negative' },
            max: { args: [100], msg: 'valor cannot exceed 100' },
            // Coherencia con tipoValor: si es %, debe venir; si es $, debe ser null
            isValidForTipoValor(value) {
                if (this.tipoValor === '%') {
                    if (value === null || value === undefined) {
                        throw new Error('valor is required when tipoValor is "%"');
                    }
                    if (Number(value) <= 0) {
                        throw new Error('valor must be greater than 0 when tipoValor is "%"');
                    }
                } else if (this.tipoValor === '$') {
                    if (value !== null && value !== undefined) {
                        throw new Error('valor must be null when tipoValor is "$"');
                    }
                }
            }
        }
    },

    // D.7 — <MontoDescuentooRecargo> — monto en DOP
    monto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'monto cannot be negative' }
        }
    },

    // D.8 — <MontoDescuentooRecargoOtraMoneda> — monto en moneda extranjera
    montoOtraMoneda: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'monto_otra_moneda',
        validate: {
            min: { args: [0], msg: 'montoOtraMoneda cannot be negative' }
        }
    },

    // D.9 — <IndicadorFacturacionDescuentooRecargo> — 1/2/3/4
    //   1 = ITBIS 1 (18%)
    //   2 = ITBIS 2 (16%)
    //   3 = ITBIS 3 (0%)
    //   4 = Exento
    indicadorFacturacion: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        field: 'indicador_facturacion',
        validate: {
            isIn: {
                args: [[1, 2, 3, 4]],
                msg: 'indicadorFacturacion must be 1, 2, 3 or 4'
            }
        }
    }
}, {
    tableName: 'invoice_discount_charges',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['invoice_id'], name: 'idx_invoice_discount_charges_invoice_id' },
        { fields: ['invoice_id', 'numero_linea'], unique: true, name: 'uq_invoice_discount_charges_invoice_numero' }
    ]
});

module.exports = InvoiceDiscountCharge;