// ============================================================
// Modelo: ApiKey
// API keys de larga duración para integraciones externas.
//
// La key completa NUNCA se guarda. Solo:
//   - key_hash: SHA-256 hex del secret completo
//   - key_prefix: primeros chars visibles (ej. pk_live_a1b2c3)
//
// El secret en claro se devuelve al usuario UNA SOLA VEZ al crear.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ApiKey = sequelize.define('ApiKey', {
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
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'API key name cannot be empty' },
            len: {
                args: [2, 100],
                msg: 'API key name must be between 2 and 100 characters'
            }
        }
    },
    keyHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'key_hash',
        validate: {
            is: {
                args: /^[0-9a-f]{64}$/,
                msg: 'keyHash must be a 64-char lowercase hex string (SHA-256)'
            }
        }
    },
    keyPrefix: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'key_prefix',
        validate: {
            notEmpty: { msg: 'keyPrefix cannot be empty' }
        }
    },
    environment: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: {
                args: [['testecf', 'production']],
                msg: 'environment must be testecf or production'
            }
        }
    },
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    },
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'created_by'
    }
}, {
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['key_hash'], unique: true, name: 'uq_api_keys_key_hash' },
        { fields: ['company_id'], name: 'idx_api_keys_company_id' },
        { fields: ['is_active'], name: 'idx_api_keys_is_active' },
        {
            fields: ['company_id', 'is_active'],
            name: 'idx_api_keys_company_active',
            where: { is_active: true }
        }
    ]
});

// ------------------------------------------------------------
// toJSON override: NUNCA exponer keyHash
// (igual que Company oculta certificatePasswordEncrypted)
// ------------------------------------------------------------
ApiKey.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.keyHash;
    return values;
};

module.exports = ApiKey;