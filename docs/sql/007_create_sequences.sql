-- ============================================================
-- Tabla: sequences
-- Propósito: Rangos de e-NCF autorizados por DGII para cada empresa
-- Depende de: companies
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    type VARCHAR(2) NOT NULL,
    prefix VARCHAR(5) NOT NULL DEFAULT 'E',
    start_number BIGINT NOT NULL,
    end_number BIGINT NOT NULL,
    current_number BIGINT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_sequences_type CHECK (
        type IN ('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
    ),
    CONSTRAINT chk_sequences_range CHECK (end_number >= start_number),
    CONSTRAINT chk_sequences_current CHECK (
        current_number >= start_number - 1 AND current_number <= end_number
    ),

    -- Unique: una empresa no puede tener dos secuencias activas del mismo tipo con el mismo prefijo
    CONSTRAINT uq_sequences_company_type_prefix UNIQUE (company_id, type, prefix),

    -- Foreign Key
    CONSTRAINT fk_sequences_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sequences_company_id ON sequences (company_id);
CREATE INDEX IF NOT EXISTS idx_sequences_is_active ON sequences (is_active);
CREATE INDEX IF NOT EXISTS idx_sequences_expires_at ON sequences (expires_at);
CREATE INDEX IF NOT EXISTS idx_sequences_company_type ON sequences (company_id, type);

-- Comentarios
COMMENT ON TABLE sequences IS 'Rangos de e-NCF autorizados por DGII para cada empresa';
COMMENT ON COLUMN sequences.company_id IS 'Empresa propietaria del rango';
COMMENT ON COLUMN sequences.type IS 'Tipo de e-CF: 31, 32, 33, 34, 41, 43, 44, 45, 46, 47';
COMMENT ON COLUMN sequences.prefix IS 'Prefijo del e-NCF (E para electrónico)';
COMMENT ON COLUMN sequences.start_number IS 'Número inicial del rango autorizado';
COMMENT ON COLUMN sequences.end_number IS 'Número final del rango autorizado';
COMMENT ON COLUMN sequences.current_number IS 'Último número usado (el siguiente será current_number + 1)';
COMMENT ON COLUMN sequences.expires_at IS 'Fecha de vencimiento del rango según DGII';
COMMENT ON COLUMN sequences.is_active IS 'Si el rango está activo para emitir';


-- ============================================================
-- Fix: eliminar UNIQUE (company_id, type, prefix) de sequences
-- Motivo: DGII permite múltiples rangos activos del mismo tipo
--        (cuando se agota uno y se solicita otro nuevo)
-- Fecha: 2026-09-26
-- ============================================================

ALTER TABLE sequences
    DROP CONSTRAINT IF EXISTS uq_sequences_company_type_prefix;


SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sequences'
ORDER BY ordinal_position;