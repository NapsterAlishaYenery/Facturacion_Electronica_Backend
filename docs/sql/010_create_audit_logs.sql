-- ============================================================
-- Tabla: audit_logs
-- Propósito: Bitácora de eventos del sistema (requisito PSFE)
-- Depende de: companies, users
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50),
    entity_id UUID,
    before JSONB,
    after JSONB,
    ip INET,
    user_agent VARCHAR(300),
    created_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Foreign Keys con SET NULL (si se borra la empresa/usuario, se conserva el log)
    CONSTRAINT fk_audit_logs_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON audit_logs (company_id, created_at);

-- Comentarios
COMMENT ON TABLE audit_logs IS 'Bitácora de eventos del sistema (requisito obligatorio PSFE)';
COMMENT ON COLUMN audit_logs.company_id IS 'Empresa afectada (NULL si es acción global del sistema)';
COMMENT ON COLUMN audit_logs.user_id IS 'Usuario que realizó la acción (NULL si fue el sistema)';
COMMENT ON COLUMN audit_logs.action IS 'Acción realizada: invoice.created, user.login, etc.';
COMMENT ON COLUMN audit_logs.entity IS 'Entidad afectada: invoice, company, user, sequence, etc.';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID del registro afectado';
COMMENT ON COLUMN audit_logs.before IS 'Estado anterior del registro (JSON)';
COMMENT ON COLUMN audit_logs.after IS 'Estado posterior del registro (JSON)';
COMMENT ON COLUMN audit_logs.ip IS 'Dirección IP del cliente que realizó la acción';
COMMENT ON COLUMN audit_logs.user_agent IS 'User-Agent del navegador/cliente';
COMMENT ON COLUMN audit_logs.created_at IS 'Fecha y hora exacta del evento (inmutable)';

--Consultas tipicas para auditorias
SELECT action, entity, entity_id, created_at
FROM audit_logs
WHERE user_id = 'uuid-del-usuario'
ORDER BY created_at DESC;

SELECT action, entity, entity_id, created_at
FROM audit_logs
WHERE company_id = 'uuid-de-la-empresa'
  AND created_at >= now() - INTERVAL '1 month'
ORDER BY created_at DESC;

SELECT user_id, action, created_at
FROM audit_logs
WHERE entity = 'invoice'
  AND entity_id = 'uuid-de-la-factura'
  AND action = 'invoice.created';

  SELECT
    created_at,
    before,
    after,
    after->>'email' AS email_nuevo,
    before->>'email' AS email_anterior
FROM audit_logs
WHERE entity = 'company'
  AND entity_id = 'uuid-de-la-empresa'
  AND action = 'company.updated'
ORDER BY created_at DESC;

--Verificacion
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_logs'::regclass
  AND contype = 'f';

  SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs'
ORDER BY indexname;