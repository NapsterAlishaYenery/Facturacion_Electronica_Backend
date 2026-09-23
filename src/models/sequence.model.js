const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sequence = sequelize.define('Sequence', {
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
    prefix: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'E',
        validate: {
            notEmpty: { msg: 'Prefix is required' }
        }
    },
    startNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'start_number',
        validate: {
            min: {
                args: [0],
                msg: 'Start number cannot be negative'
            }
        }
    },
    endNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'end_number'
    },
    currentNumber: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'current_number',
        validate: {
            min: {
                args: [-1],
                msg: 'Current number cannot be less than -1'
            }
        }
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    }
}, {
    tableName: 'sequences',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['company_id'], name: 'idx_sequences_company_id' },
        { fields: ['is_active'], name: 'idx_sequences_is_active' },
        { fields: ['expires_at'], name: 'idx_sequences_expires_at' },
        { fields: ['company_id', 'type'], name: 'idx_sequences_company_type' }
    ],
    validate: {
        // end_number >= start_number
        rangeIsValid() {
            if (this.endNumber < this.startNumber) {
                throw new Error('end_number must be >= start_number');
            }
        },
        // current_number entre start-1 y end
        currentNumberInRange() {
            const min = this.startNumber - 1;
            if (this.currentNumber < min || this.currentNumber > this.endNumber) {
                throw new Error('current_number must be between start_number - 1 and end_number');
            }
        }
    }
});

module.exports = Sequence;