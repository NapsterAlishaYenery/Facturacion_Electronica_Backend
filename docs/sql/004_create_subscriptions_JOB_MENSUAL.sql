-- ============================================================
-- Tabla: subscriptions
-- Propósito: Qué plan tiene contratado cada empresa, cuándo vence
-- Depende de: companies, plans
-- Fase: 1
-- Fecha: 2026-09-22
-- JOB PENDIENTE 
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMP,
    starts_at TIMESTAMP NOT NULL DEFAULT now(),
    ends_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    invoices_used_this_month INT NOT NULL DEFAULT 0,
    current_period_start TIMESTAMP NOT NULL DEFAULT now(),
    current_period_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_subscriptions_status CHECK (
        status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')
    ),
    CONSTRAINT chk_subscriptions_invoices_used CHECK (invoices_used_this_month >= 0),
    CONSTRAINT chk_subscriptions_ends_at CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT chk_subscriptions_trial_dates CHECK (
        trial_ends_at IS NULL OR trial_ends_at > starts_at
    ),

    -- Foreign Keys
    CONSTRAINT fk_subscriptions_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscriptions_plan
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions (company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_status ON subscriptions (company_id, status);

-- Comentarios (documentación viva de la BD)
COMMENT ON TABLE subscriptions IS 'Suscripciones activas de cada empresa al SaaS';
COMMENT ON COLUMN subscriptions.company_id IS 'Empresa que contrata el plan';
COMMENT ON COLUMN subscriptions.plan_id IS 'Plan contratado (basic, pro, enterprise)';
COMMENT ON COLUMN subscriptions.status IS 'Estado: trial, active, past_due, cancelled, expired';
COMMENT ON COLUMN subscriptions.trial_ends_at IS 'Fecha en que termina el período de prueba (NULL si no aplica)';
COMMENT ON COLUMN subscriptions.starts_at IS 'Fecha en que comenzó la suscripción';
COMMENT ON COLUMN subscriptions.ends_at IS 'Fecha en que termina (NULL = auto-renovable)';
COMMENT ON COLUMN subscriptions.cancelled_at IS 'Fecha en que el cliente canceló (NULL si sigue activa)';
COMMENT ON COLUMN subscriptions.invoices_used_this_month IS 'Contador de facturas emitidas en el mes actual';
COMMENT ON COLUMN subscriptions.current_period_start IS 'Inicio del período actual de facturación';
COMMENT ON COLUMN subscriptions.current_period_end IS 'Fin del período actual de facturación';

SELECT * FROM subscriptions 
WHERE company_id = 'aqui-va-un-uuid-real' 
AND status = 'active';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'subscriptions'::regclass
  AND contype = 'f'
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'subscriptions'
ORDER BY indexname;

INSERT INTO subscriptions (company_id, plan_id, status)
VALUES ('00000000-0000-0000-0000-000000000000', 
        (SELECT id FROM plans WHERE code = 'basic'), 
        'trial');

		INSERT INTO subscriptions (company_id, plan_id, status)
VALUES ((SELECT id FROM companies LIMIT 1), 
        (SELECT id FROM plans WHERE code = 'basic'), 
        'estado_invalido');


-- JOB MENSUAL AUN SIN EJECUTAR
UPDATE subscriptions
SET invoices_used_this_month = 0,
    current_period_start = now(),
    current_period_end = now() + INTERVAL '1 month'
WHERE status IN ('trial', 'active');