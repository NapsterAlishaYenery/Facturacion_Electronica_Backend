const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordReset = sequelize.define('PasswordReset', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
    },
    code: {
        type: DataTypes.STRING(6),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Code is required' },
            len: { args: [6, 6], msg: 'Code must be 6 characters' }
        }
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
    },
    usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'used_at'
    }
}, {
    tableName: 'password_resets',
    timestamps: true,
    updatedAt: false,  // No tiene updated_at
    underscored: true,
    indexes: [
        { fields: ['user_id'], name: 'idx_password_resets_user_id' },
        { fields: ['code'], name: 'idx_password_resets_code' },
        { fields: ['expires_at'], name: 'idx_password_resets_expires_at' }
    ]
});

module.exports = PasswordReset;