const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Province = sequelize.define('Province', {
    dgiiCode: {
        type: DataTypes.STRING(6),
        primaryKey: true,
        allowNull: false,
        field: 'dgii_code',
        validate: {
            is: {
                args: /^\d{6}$/,
                msg: 'dgiiCode must be exactly 6 digits'
            }
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    }
}, {
    tableName: 'provinces',
    timestamps: true,
    underscored: true
});

module.exports = Province;