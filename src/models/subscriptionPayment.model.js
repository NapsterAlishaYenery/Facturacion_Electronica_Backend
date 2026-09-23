const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SubscriptionPayment = sequelize.define('SubscriptionPayment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    subscriptionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'subscription_id'
    },
    companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id'
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0.01],
                msg: 'Amount must be greater than 0'
            }
        }
    },
    currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'DOP',
        validate: {
            isIn: {
                args: [['DOP', 'USD']],
                msg: 'Currency must be DOP or USD'
            }
        }
    },
    paymentMethod: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'payment_method',
        validate: {
            isIn: {
                args: [[null, 'cash', 'transfer', 'card', 'stripe', 'paypal']],
                msg: 'Invalid payment method'
            }
        }
    },
    reference: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    periodStart: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'period_start'
    },
    periodEnd: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'period_end'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
            isIn: {
                args: [['pending', 'paid', 'failed', 'refunded']],
                msg: 'Status must be pending, paid, failed or refunded'
            }
        }
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paid_at'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'subscription_payments',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['subscription_id'], name: 'idx_sub_payments_subscription_id' },
        { fields: ['company_id'], name: 'idx_sub_payments_company_id' },
        { fields: ['status'], name: 'idx_sub_payments_status' },
        { fields: ['paid_at'], name: 'idx_sub_payments_paid_at' },
        { fields: ['period_start', 'period_end'], name: 'idx_sub_payments_period' }
    ],
    validate: {
        // Cross-field: replica el CHECK de la BD
        periodEndAfterStart() {
            if (this.periodEnd && this.periodStart && this.periodEnd <= this.periodStart) {
                throw new Error('period_end must be after period_start');
            }
        }
    }
});

module.exports = SubscriptionPayment;