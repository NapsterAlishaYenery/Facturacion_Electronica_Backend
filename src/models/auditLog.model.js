const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
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
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id'
    },
    action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Action is required' },
            len: {
                args: [3, 100],
                msg: 'Action must be between 3 and 100 characters'
            }
        }
    },
    entity: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    entityId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'entity_id'
    },
    before: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    after: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    ip: {
        type: DataTypes.INET,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.STRING(300),
        allowNull: true,
        field: 'user_agent'
    }
}, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: true,
    updatedAt: false, // audit_logs NO tiene updated_at
    underscored: true,
    indexes: [
        { fields: ['company_id'], name: 'idx_audit_logs_company_id' },
        { fields: ['user_id'], name: 'idx_audit_logs_user_id' },
        { fields: ['action'], name: 'idx_audit_logs_action' },
        { fields: ['entity', 'entity_id'], name: 'idx_audit_logs_entity' },
        { fields: ['created_at'], name: 'idx_audit_logs_created_at' },
        { fields: ['company_id', 'created_at'], name: 'idx_audit_logs_company_created' }
    ],
    hooks: {
        // Bloquear updates: los logs son inmutables
        beforeUpdate: () => {
            throw new Error('Audit logs are immutable. Updates are not allowed.');
        },
        // Bloquear deletes (excepto por limpieza controlada)
        beforeDestroy: () => {
            throw new Error('Audit logs are immutable. Use a dedicated cleanup job to delete old logs.');
        }
    }
});

module.exports = AuditLog;