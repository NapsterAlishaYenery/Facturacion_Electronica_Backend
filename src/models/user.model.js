const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'company_id'
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Email is required' },
            isEmail: { msg: 'Invalid email format' }
        }
    },
    passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash'
    },
    firstName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'first_name',
        validate: {
            notEmpty: { msg: 'First name is required' },
            len: { args: [2, 80], msg: 'First name must be between 2 and 80 characters' }
        }
    },
    middleName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'middle_name'
    },
    lastName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'last_name',
        validate: {
            notEmpty: { msg: 'Last name is required' },
            len: { args: [2, 80], msg: 'Last name must be between 2 and 80 characters' }
        }
    },
    secondLastName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'second_last_name'
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: {
                args: [['admin', 'company_admin', 'operator']],
                msg: 'Role must be admin, company_admin or operator'
            }
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at'
    },

    // Campo virtual para recibir la contraseña
    password: {
        type: DataTypes.VIRTUAL,
        allowNull: true,
        validate: {
            len: {
                args: [8, 100],
                msg: 'Password must be between 8 and 100 characters'
            }
        }
    },

    // Campo virtual para el nombre completo (no se guarda en BD)
    fullName: {
        type: DataTypes.VIRTUAL,
        get() {
            const parts = [
                this.firstName,
                this.middleName,
                this.lastName,
                this.secondLastName
            ].filter(Boolean);
            return parts.join(' ');
        }
    }
}, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['email'], name: 'idx_users_email' },
        { fields: ['company_id'], name: 'idx_users_company_id' },
        { fields: ['role'], name: 'idx_users_role' },
        { fields: ['is_active'], name: 'idx_users_is_active' },
        { fields: ['last_name'], name: 'idx_users_last_name' }
    ],
    //Diferentes hook posibles
    //beforeValidate → validación → afterValidate → beforeCreate → INSERT → afterCreate
    hooks: {
        beforeValidate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(12);
                user.passwordHash = await bcrypt.hash(user.password, salt);
                user.password = undefined;
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password') && user.password) {
                const salt = await bcrypt.genSalt(12);
                user.passwordHash = await bcrypt.hash(user.password, salt);
                user.password = undefined;
            }
        }
    }
});

// Método de instancia: comparar contraseña
User.prototype.validatePassword = async function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

// Método estático: buscar por email sin exponer el hash
User.findByEmail = async function (email) {
    return this.findOne({ where: { email: email.toLowerCase().trim() } });
};

module.exports = User;