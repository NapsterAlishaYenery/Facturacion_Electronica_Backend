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
    certificatePassword: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'certificate_password'
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
    }
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