// ============================================================
// Modelo: Product
// Catálogo de productos/servicios por empresa para el POS interno.
//
// Soporta bienes físicos y servicios (multi-rubro):
//   - Eventos, catering, decoración (servicios)
//   - Videojuegos (bienes)
//   - Empanadas, restaurantes (bienes con fechas)
//   - Drinks, licores (bienes con grados alcohol)
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
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
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Product name cannot be empty' },
            len: {
                args: [2, 200],
                msg: 'Product name must be between 2 and 200 characters'
            }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Product price cannot be negative'
            },
            isDecimal: { msg: 'Product price must be a valid decimal' }
        }
    },
    taxType: {
        // MVP: solo los 3 tratamientos del ITBIS
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'tax_type',
        validate: {
            isIn: {
                args: [['ITBIS_18', 'ITBIS_16', 'EXENTO']],
                msg: 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO'
            }
        }
    },
    itemCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'item_code'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
    },

    // ============================================================
    // CAMPOS DGII NUEVOS (para multi-rubro)
    // ============================================================

    // Naturaleza del ítem (obligatorio)
    indicadorBienoServicio: {
        // 1 = Bien, 2 = Servicio
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 1,
        field: 'indicador_bieno_servicio',
        validate: {
            isIn: {
                args: [[1, 2]],
                msg: 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)'
            }
        }
    },

    // Unidad de medida DGII (1-62). NULL = no se envía (válido para servicios)
    unidadMedida: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'unidad_medida',
        validate: {
            min: { args: [1], msg: 'unidadMedida must be between 1 and 62' },
            max: { args: [62], msg: 'unidadMedida must be between 1 and 62' }
        }
    },

    // Grados alcohol (solo licores)
    gradosAlcohol: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        field: 'grados_alcohol',
        validate: {
            min: { args: [0], msg: 'gradosAlcohol cannot be negative' },
            max: { args: [100], msg: 'gradosAlcohol cannot exceed 100' }
        }
    },

    // Fechas (alimentos/medicinas)
    fechaElaboracion: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_elaboracion'
    },
    fechaVencimientoItem: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_vencimiento_item'
    },

    // Referencias opcionales
    cantidadReferencia: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
        field: 'cantidad_referencia',
        validate: {
            min: { args: [0], msg: 'cantidadReferencia cannot be negative' }
        }
    },
    unidadReferencia: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'unidad_referencia',
        validate: {
            min: { args: [1], msg: 'unidadReferencia must be between 1 and 62' },
            max: { args: [62], msg: 'unidadReferencia must be between 1 and 62' }
        }
    },
    precioUnitarioReferencia: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        field: 'precio_unitario_referencia',
        validate: {
            min: { args: [0], msg: 'precioUnitarioReferencia cannot be negative' }
        }
    }
}, {
    tableName: 'products',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['company_id'] },
        { fields: ['is_active'] },
        { fields: ['company_id', 'is_active'] },
        { fields: ['company_id', 'indicador_bieno_servicio'], name: 'idx_products_company_bieno_servicio' }
    ]
});

module.exports = Product;