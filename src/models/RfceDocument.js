// src/models/RfceDocument.js
//
// DT39 — Resumen de Factura de Consumo (RFCE)
//
// Solo se crea para invoices de type=32 con total < 250,000.
// El e-CF 32 completo se guarda en `invoices.xml_content` (para auditoría
// y para el PDF impreso). El RFCE es el XML que se envía a DGII en lugar
// del e-CF completo, y se guarda aquí.
//
// Relación: Invoice.hasOne(RfceDocument)

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RfceDocument = sequelize.define('RfceDocument', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    invoiceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'invoice_id'
    },

    // ============================================================
    // XML del RFCE
    // ============================================================
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

    // ============================================================
    // Código de seguridad
    // ============================================================
    // 6 primeros caracteres del <SignatureValue> del e-CF 32 firmado.
    // Placeholder '000000' hasta que el e-CF se firme.
    codigoSeguridad: {
        type: DataTypes.STRING(6),
        allowNull: true,
        field: 'codigo_seguridad',
        validate: {
            isValidLength(value) {
                if (value === null || value === undefined) return;
                if (String(value).length !== 6) {
                    throw new Error('codigoSeguridad must be exactly 6 characters');
                }
            }
        }
    },

    // ============================================================
    // Ciclo de vida del RFCE
    // ============================================================
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: {
            isIn: {
                args: [['draft', 'signed', 'sent', 'accepted', 'rejected']],
                msg: 'Invalid RFCE status'
            }
        }
    },
    trackId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'track_id'
    },
    dgiiResponse: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'dgii_response'
    },
    sendAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'send_attempts',
        validate: {
            min: { args: [0], msg: 'send_attempts cannot be negative' }
        }
    }
}, {
    tableName: 'rfce_documents',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['invoice_id'], unique: true, name: 'uq_rfce_documents_invoice_id' },
        { fields: ['status'], name: 'idx_rfce_documents_status' },
        { fields: ['track_id'], name: 'idx_rfce_documents_track_id' }
    ]
});

module.exports = RfceDocument;