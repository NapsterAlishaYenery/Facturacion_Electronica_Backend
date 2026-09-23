const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
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
    planId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'plan_id'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'trial',
        validate: {
            isIn: {
                args: [['trial', 'active', 'past_due', 'cancelled', 'expired']],
                msg: 'Status must be trial, active, past_due, cancelled or expired'
            }
        }
    },
    trialEndsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'trial_ends_at'
    },
    startsAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'starts_at'
    },
    endsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ends_at'
    },
    cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'cancelled_at'
    },
    invoicesUsedThisMonth: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'invoices_used_this_month',
        validate: {
            min: {
                args: [0],
                msg: 'Invoices used cannot be negative'
            }
        }
    },
    currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'current_period_start'
    },
    currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'current_period_end'
    }
}, {
    tableName: 'subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['company_id'], name: 'idx_subscriptions_company_id' },
        { fields: ['plan_id'], name: 'idx_subscriptions_plan_id' },
        { fields: ['status'], name: 'idx_subscriptions_status' },
        { fields: ['company_id', 'status'], name: 'idx_subscriptions_company_status' }
    ],
    validate: {
        // Validación cross-field: replica los CHECK de la BD
        endsAtAfterStartsAt() {
            if (this.endsAt && this.startsAt && this.endsAt <= this.startsAt) {
                throw new Error('ends_at must be after starts_at');
            }
        },
        trialEndsAtAfterStartsAt() {
            if (this.trialEndsAt && this.startsAt && this.trialEndsAt <= this.startsAt) {
                throw new Error('trial_ends_at must be after starts_at');
            }
        }
    }
});

module.exports = Subscription;