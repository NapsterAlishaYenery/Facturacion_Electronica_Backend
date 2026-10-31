-- ============================================================
-- Tabla: job_runs
-- Propósito: Historial persistente de cada corrida de job (cron o manual)
-- Depende de: nada (sin FKs)
-- Fase: 9 (Admin dashboard)
-- Fecha: 2026-10-30
-- ============================================================

CREATE TABLE job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    affected INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    meta JSONB,
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'cron',
    started_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_job_runs_status CHECK (
        status IN ('success', 'failed', 'skipped')
    ),
    CONSTRAINT chk_job_runs_triggered_by CHECK (
        triggered_by IN ('cron', 'manual')
    ),
    CONSTRAINT chk_job_runs_affected CHECK (affected >= 0),
    CONSTRAINT chk_job_runs_duration CHECK (duration_ms >= 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_job_runs_job_name_started_at
    ON job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_status
    ON job_runs (status);
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at
    ON job_runs (started_at DESC);

-- Comentarios
COMMENT ON TABLE job_runs IS 'Historial de corridas de jobs programados (cron) y manuales';
COMMENT ON COLUMN job_runs.job_name IS 'Nombre canónico del job (ej: subscription-lifecycle)';
COMMENT ON COLUMN job_runs.status IS 'Resultado de la corrida: success, failed o skipped';
COMMENT ON COLUMN job_runs.affected IS 'Cantidad de filas/entidades afectadas';
COMMENT ON COLUMN job_runs.duration_ms IS 'Duración de la corrida en milisegundos';
COMMENT ON COLUMN job_runs.error IS 'Mensaje de error si status = failed';
COMMENT ON COLUMN job_runs.meta IS 'Metadata adicional devuelta por el job (JSON libre)';
COMMENT ON COLUMN job_runs.triggered_by IS 'Origen: cron (automático) o manual (admin)';
COMMENT ON COLUMN job_runs.started_at IS 'Momento en que inició la corrida';

-- ============================================================
-- Verificación
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'job_runs'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'job_runs'::regclass
  AND contype = 'c'
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'job_runs'
ORDER BY indexname;