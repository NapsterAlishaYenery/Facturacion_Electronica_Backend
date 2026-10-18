// ============================================================
// Modelo: CompanyLogo
// Almacena la metadata del logo subido a Cloudinary.
// El archivo binario vive en Cloudinary, aquí solo la referencia.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompanyLogo = sequelize.define('CompanyLogo', {
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
    purpose: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'invoice',
        validate: {
            isIn: {
                args: [['invoice', 'dashboard']],
                msg: 'Purpose must be invoice or dashboard'
            }
        }
    },
    publicId: {
        type: DataTypes.STRING(300),
        allowNull: false,
        field: 'public_id',
        validate: {
            notEmpty: { msg: 'Public ID is required' }
        }
    },
    url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'URL is required' }
        }
    },
    secureUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'secure_url',
        validate: {
            notEmpty: { msg: 'Secure URL is required' }
        }
    },
    format: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    width: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    height: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    bytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    uploadedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'uploaded_at'
    }
}, {
    tableName: 'company_logos',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['company_id', 'purpose'],
            name: 'uq_company_logos_company_purpose'
        }
    ]
});

module.exports = CompanyLogo;