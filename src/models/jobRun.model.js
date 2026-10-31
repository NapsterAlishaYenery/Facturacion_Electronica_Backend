// ============================================================
// Modelo: JobRun
// Historial persistente de cada corrida de job (cron o manual)
// ============================================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobRun = sequelize.define('JobRun', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    jobName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'job_name',
        validate: {
            notEmpty: { msg: 'Job name is required' },
            len: { args: [1, 100], msg: 'Job name must be between 1 and 100 characters' }
        }
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: {
                args: [['success', 'failed', 'skipped']],
                msg: 'Status must be success, failed or skipped'
            }
        }
    },
    affected: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: [0], msg: 'Affected cannot be negative' }
        }
    },
    durationMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'duration_ms',
        validate: {
            min: { args: [0], msg: 'Duration cannot be negative' }
        }
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    meta: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    triggeredBy: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'cron',
        field: 'triggered_by',
        validate: {
            isIn: {
                args: [['cron', 'manual']],
                msg: 'TriggeredBy must be cron or manual'
            }
        }
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'started_at'
    }
}, {
    tableName: 'job_runs',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['job_name', 'started_at'], name: 'idx_job_runs_job_name_started_at' },
        { fields: ['status'], name: 'idx_job_runs_status' },
        { fields: ['started_at'], name: 'idx_job_runs_started_at' }
    ]
});

module.exports = JobRun;