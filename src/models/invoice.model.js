const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
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
    sequenceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sequence_id'
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
    ncf: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'NCF is required' }
        }
    },
    trackId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'track_id'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency']],
                msg: 'Invalid invoice status'
            }
        }
    },
    xmlContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'xml_content'
    },
    xmlSigned: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'xml_signed'
    },
    dgiiResponse: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'dgii_response'
    },
    issuerRnc: {
        type: DataTypes.STRING(15),
        allowNull: false,
        field: 'issuer_rnc',
        validate: {
            notEmpty: { msg: 'Issuer RNC is required' }
        }
    },
    issuerName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'issuer_name',
        validate: {
            notEmpty: { msg: 'Issuer name is required' }
        }
    },
    receiverRnc: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'receiver_rnc'
    },
    receiverName: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'receiver_name'
    },
    subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Subtotal cannot be negative'
            }
        }
    },
    itbis: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: {
                args: [0],
                msg: 'ITBIS cannot be negative'
            }
        }
    },
    total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Total cannot be negative'
            }
        }
    },
    issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'issued_at'
    },
    // 🔥 NUEVO: campos específicos de Notas de Débito/Crédito (33/34)
    modifiedNcf: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'modified_ncf',
        validate: {
            len: {
                args: [11, 19],
                msg: 'Modified NCF must be between 11 and 19 characters'
            }
        }
    },
    modifiedNcfIssuerRnc: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'modified_ncf_issuer_rnc'
    },
    modifiedNcfDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'modified_ncf_date'
    },
    modificationCode: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'modification_code',
        validate: {
            min: {
                args: [1],
                msg: 'Modification code must be between 1 and 5'
            },
            max: {
                args: [5],
                msg: 'Modification code must be between 1 and 5'
            }
        }
    },
    modificationReason: {
        type: DataTypes.STRING(90),
        allowNull: true,
        field: 'modification_reason',
        validate: {
            len: {
                args: [0, 90],
                msg: 'Modification reason cannot exceed 90 characters'
            }
        }
    },
    indicadorNotaCredito: {
        type: DataTypes.SMALLINT,
        allowNull: true,
        field: 'indicador_nota_credito',
        validate: {
            isIn: {
                args: [[0, 1]],
                msg: 'IndicadorNotaCredito must be 0 or 1'
            }
        }
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['company_id'], name: 'idx_invoices_company_id' },
        { fields: ['sequence_id'], name: 'idx_invoices_sequence_id' },
        { fields: ['status'], name: 'idx_invoices_status' },
        { fields: ['track_id'], name: 'idx_invoices_track_id' },
        { fields: ['ncf'], name: 'idx_invoices_ncf' },
        { fields: ['issued_at'], name: 'idx_invoices_issued_at' },
        { fields: ['company_id', 'status'], name: 'idx_invoices_company_status' },
        { fields: ['company_id', 'issued_at'], name: 'idx_invoices_company_issued' },
        { fields: ['company_id', 'ncf'], unique: true, name: 'uq_invoices_company_ncf' },
        { fields: ['modified_ncf'], name: 'idx_invoices_modified_ncf' },
        { fields: ['company_id', 'type', 'modified_ncf'], name: 'idx_invoices_company_type_modified' }
    ]
});

module.exports = Invoice;