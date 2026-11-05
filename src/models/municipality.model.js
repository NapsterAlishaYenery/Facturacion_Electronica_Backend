const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Municipality = sequelize.define('Municipality', {
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
    provinceDgiiCode: {
        type: DataTypes.STRING(6),
        allowNull: false,
        field: 'province_dgii_code'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    isDistrict: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_district'
    }
}, {
    tableName: 'municipalities',
    timestamps: true,
    underscored: true
});

module.exports = Municipality;