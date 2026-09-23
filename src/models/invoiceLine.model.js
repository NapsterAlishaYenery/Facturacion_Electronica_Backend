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
    itemCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'item_code'
    },
    description: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description is required' },
            len: {
                args: [1, 500],
                msg: 'Description must be between 1 and 500 characters'
            }
        }
    },
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
        { fields: ['invoice_id', 'line_number'], unique: true, name: 'uq_invoice_lines_invoice_line' }
    ]
});

module.exports = InvoiceLine;