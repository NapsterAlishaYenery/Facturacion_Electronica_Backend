-- ============================================================
-- Tabla: api_keys
-- Propósito: API keys de larga duración para clientes con POS
--            propio que integran el facturador vía HTTP.
--            Solo disponible en plan enterprise (features.api_access).
-- Fecha: 2026-10-19
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL
        REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name VARCHAR(100) NOT NULL,

    -- SHA-256 hex del secret completo. NUNCA se guarda el secret en claro.
    key_hash VARCHAR(64) NOT NULL,

    -- Prefijo visible: "pk_live_a1b2c3" o "pk_test_a1b2c3"
    key_prefix VARCHAR(20) NOT NULL,

    -- Ambiente al que pertenece la key al momento de crearla.
    -- Copiado de company.dgiiEnvironment. Informativo/visual.
    environment VARCHAR(20) NOT NULL
        CHECK (environment IN ('testecf', 'production')),

    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,          -- NULL = no expira
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ,

    created_by UUID
        REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON api_keys (company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys (is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_active
    ON api_keys (company_id, is_active)
    WHERE is_active = true;

-- Comentarios
COMMENT ON TABLE api_keys IS 'API keys de larga duración por empresa para integraciones externas (plan enterprise)';
COMMENT ON COLUMN api_keys.name IS 'Nombre descriptivo (ej. "POS sucursal 1", "Integración ERP")';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hex del secret. NUNCA se guarda el secret en claro.';
COMMENT ON COLUMN api_keys.key_prefix IS 'Prefijo visible del secret (ej. "pk_live_a1b2c3")';
COMMENT ON COLUMN api_keys.environment IS 'testecf o production. Copiado de company.dgiiEnvironment al crear.';
COMMENT ON COLUMN api_keys.last_used_at IS 'Última vez que la key autenticó (fire-and-forget, puede tener lag).';
COMMENT ON COLUMN api_keys.expires_at IS 'Opcional. NULL = no expira.';
COMMENT ON COLUMN api_keys.is_active IS 'false = revocada (no autentica, se conserva para auditoría).';
COMMENT ON COLUMN api_keys.revoked_at IS 'Timestamp de revocación (NULL si activa).';
COMMENT ON COLUMN api_keys.created_by IS 'User que creó la key.';

-- Verificación
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'api_keys'
ORDER BY indexname;