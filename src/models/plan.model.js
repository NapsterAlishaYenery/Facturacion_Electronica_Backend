const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plan = sequelize.define('Plan', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Plan code is required' },
            len: {
                args: [2, 50],
                msg: 'Plan code must be between 2 and 50 characters'
            }
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Plan name is required' }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    priceDop: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'price_dop',
        validate: {
            min: {
                args: [0],
                msg: 'Price in DOP cannot be negative'
            }
        }
    },
    priceUsd: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'price_usd',
        validate: {
            min: {
                args: [0],
                msg: 'Price in USD cannot be negative'
            }
        }
    },
    invoicesPerMonth: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'invoices_per_month',
        validate: {
            min: {
                args: [-1],
                msg: 'Invoices per month must be -1 (unlimited) or greater'
            }
        }
    },
    maxUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'max_users',
        validate: {
            min: {
                args: [-1],
                msg: 'Max users must be -1 (unlimited) or greater'
            }
        }
    },
    maxSequences: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'max_sequences',
        validate: {
            min: {
                args: [-1],
                msg: 'Max sequences must be -1 (unlimited) or greater'
            }
        }
    },
    features: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    }
}, {
    tableName: 'plans',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['code'], name: 'idx_plans_code' },
        { fields: ['is_active'], name: 'idx_plans_is_active' }
    ]
});

module.exports = Plan;