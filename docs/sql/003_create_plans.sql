-- ============================================================
-- Tabla: plans
-- Propósito: Catálogo de planes SaaS que ofrecemos a las empresas
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_dop DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_usd DECIMAL(10,2),
    invoices_per_month INT NOT NULL DEFAULT 0,
    max_users INT NOT NULL DEFAULT 1,
    max_sequences INT NOT NULL DEFAULT 1,
    features JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_plans_price_dop CHECK (price_dop >= 0),
    CONSTRAINT chk_plans_price_usd CHECK (price_usd IS NULL OR price_usd >= 0),
    CONSTRAINT chk_plans_invoices CHECK (invoices_per_month >= -1),
    CONSTRAINT chk_plans_max_users CHECK (max_users >= -1),
    CONSTRAINT chk_plans_max_sequences CHECK (max_sequences >= -1)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plans_code ON plans (code);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans (is_active);

-- Comentarios (documentación viva de la BD)
COMMENT ON TABLE plans IS 'Catálogo de planes SaaS ofrecidos a las empresas';
COMMENT ON COLUMN plans.code IS 'Código único del plan: basic, pro, enterprise';
COMMENT ON COLUMN plans.name IS 'Nombre visible del plan: Plan Básico, Plan Pro';
COMMENT ON COLUMN plans.invoices_per_month IS 'Límite de facturas por mes (-1 = ilimitado)';
COMMENT ON COLUMN plans.max_users IS 'Límite de usuarios por empresa (-1 = ilimitado)';
COMMENT ON COLUMN plans.max_sequences IS 'Límite de secuencias NCF activas (-1 = ilimitado)';
COMMENT ON COLUMN plans.features IS 'Funcionalidades extra en formato JSON: {"reports": true, "api_access": false}';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'plans'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'plans'::regclass
ORDER BY conname;

--Datos de pruebas
INSERT INTO plans (code, name, description, price_dop, price_usd, invoices_per_month, max_users, max_sequences, features)
VALUES
    ('basic', 'Plan Básico', 'Para pequeñas empresas que inician en facturación electrónica',
     1000.00, 17.00, 200, 2, 2,
     '{"reports": false, "api_access": false, "support": "email"}'::jsonb),

    ('pro', 'Plan Profesional', 'Para empresas en crecimiento con más volumen de facturación',
     2500.00, 42.00, 1000, 10, 5,
     '{"reports": true, "api_access": false, "support": "email_whatsapp"}'::jsonb),

    ('enterprise', 'Plan Empresarial', 'Para grandes empresas con necesidades avanzadas',
     5000.00, 85.00, -1, -1, -1,
     '{"reports": true, "api_access": true, "support": "24_7", "custom_integrations": true}'::jsonb);

	 SELECT code, name, price_dop, invoices_per_month, max_users FROM plans ORDER BY price_dop;

	 INSERT INTO plans (code, name, price_dop, invoices_per_month, max_users, max_sequences)
VALUES ('test', 'Test', -100, 100, 1, 1);