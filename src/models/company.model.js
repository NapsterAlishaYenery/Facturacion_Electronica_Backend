const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const Company = sequelize.define('Company', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    rnc: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'RNC is required' },
            is: {
                args: /^\d{9}$|^\d{11}$/,
                msg: 'RNC must be 9 or 11 digits'
            }
        }
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Name is required' },
            len: {
                args: [2, 200],
                msg: 'Name must be between 2 and 200 characters'
            }
        }
    },
    tradeName: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'trade_name'
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: {
            isEmail: { msg: 'Invalid email format' }
        }
    },
    phone: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    address: {
        type: DataTypes.STRING(300),
        allowNull: true
    },
    economicActivity: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'economic_activity'
    },
    certificatePath: {
        type: DataTypes.STRING(300),
        allowNull: true,
        field: 'certificate_path'
    },
    certificatePasswordEncrypted: {
        type: DataTypes.STRING(500),  // ← ampliado porque el cifrado añade iv:authTag:encrypted
        allowNull: true,
        field: 'certificate_password_encrypted'
    },
    certificateIv: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'certificate_iv'
    },
    certificateAuthTag: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'certificate_auth_tag'
    },
    certificateUploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'certificate_uploaded_at'
    },
    certificateExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'certificate_expires_at'
    },
    dgiiEnvironment: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'testecf',
        field: 'dgii_environment',
        validate: {
            isIn: {
                args: [['testecf', 'production']],
                msg: 'DGII environment must be testecf or production'
            }
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    },
    isSystemOwner: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_system_owner'
    },
    provinceDgiiCode: {
        type: DataTypes.STRING(6),
        allowNull: false,
        field: 'province_dgii_code',
        validate: {
            is: {
                args: /^\d{6}$/,
                msg: 'provinceDgiiCode must be exactly 6 digits'
            }
        }
    },
    municipalityDgiiCode: {
        type: DataTypes.STRING(6),
        allowNull: false,
        field: 'municipality_dgii_code',
        validate: {
            is: {
                args: /^\d{6}$/,
                msg: 'municipalityDgiiCode must be exactly 6 digits'
            }
        }
    },
    // ============================================================
    // DT30 — Campos adicionales del <Emisor> (PDF DGII v1.0)
    // ============================================================
    sucursal: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'sucursal',
        validate: {
            len: {
                args: [0, 20],
                msg: 'Sucursal cannot exceed 20 characters'
            }
        }
    },
    website: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'website',
        validate: {
            len: {
                args: [0, 50],
                msg: 'Website cannot exceed 50 characters'
            }
        }
    },
    additionalPhones: {
        // Hasta 2 teléfonos adicionales al campo `phone`.
        // Formato: ["809-555-1234", "829-555-5678"]
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'additional_phones',
        validate: {
            isValidPhonesArray(value) {
                if (value === null || value === undefined) return;
                if (!Array.isArray(value)) {
                    throw new Error('additionalPhones must be an array');
                }
                if (value.length > 2) {
                    throw new Error('additionalPhones cannot have more than 2 items');
                }
                for (const p of value) {
                    if (typeof p !== 'string') {
                        throw new Error('additionalPhones items must be strings');
                    }
                    if (p.length > 30) {
                        throw new Error('additionalPhones items cannot exceed 30 characters');
                    }
                }
            }
        }
    },
}, {
    tableName: 'companies',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['rnc'], name: 'idx_companies_rnc' },
        { fields: ['is_active'], name: 'idx_companies_is_active' }
    ]
});

module.exports = Company;