const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvoiceSubtotal = sequelize.define('InvoiceSubtotal', {
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
    numeroSubtotal: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        field: 'numero_subtotal',
        validate: {
            min: { args: [1], msg: 'numeroSubtotal must be between 1 and 20' },
            max: { args: [20], msg: 'numeroSubtotal must be between 1 and 20' }
        }
    },
    descripcion: {
        type: DataTypes.STRING(40),
        allowNull: true,
        validate: {
            len: { args: [0, 40], msg: 'DescripcionSubtotal cannot exceed 40 characters' }
        }
    },
    orden: {
        type: DataTypes.SMALLINT,
        allowNull: true
    },
    montoGravadoTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_gravado_total'
    },
    montoGravadoI1: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_gravado_i1'
    },
    montoGravadoI2: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_gravado_i2'
    },
    montoGravadoI3: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_gravado_i3'
    },
    subTotalItbis: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_itbis'
    },
    subTotalItbis1: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_itbis1'
    },
    subTotalItbis2: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_itbis2'
    },
    subTotalItbis3: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_itbis3'
    },
    subTotalImpuestoAdicional: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_impuesto_adicional'
    },
    subTotalExento: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'sub_total_exento'
    },
    montoSubTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'monto_sub_total'
    },
    lineas: {
        type: DataTypes.SMALLINT,
        allowNull: true
    }
}, {
    tableName: 'invoice_subtotals',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['invoice_id'], name: 'idx_invoice_subtotals_invoice_id' },
        { fields: ['invoice_id', 'numero_subtotal'], unique: true, name: 'uq_invoice_subtotals_invoice_numero' }
    ]
});

module.exports = InvoiceSubtotal;