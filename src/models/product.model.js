// ============================================================
// Modelo: Product
// Catálogo de productos/servicios por empresa para el POS interno.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
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
    name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Product name cannot be empty' },
            len: {
                args: [2, 200],
                msg: 'Product name must be between 2 and 200 characters'
            }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Product price cannot be negative'
            },
            isDecimal: { msg: 'Product price must be a valid decimal' }
        }
    },
    taxType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'tax_type',
        validate: {
            isIn: {
                args: [['ITBIS_18', 'ITBIS_16', 'EXENTO', 'ITBIS_3_46']],
                msg: 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO, ITBIS_3_46'
            }
        }
    },
    itemCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'item_code'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    }
}, {
    tableName: 'products',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['company_id'] },
        { fields: ['is_active'] },
        { fields: ['company_id', 'is_active'] }
    ]
});

module.exports = Product;