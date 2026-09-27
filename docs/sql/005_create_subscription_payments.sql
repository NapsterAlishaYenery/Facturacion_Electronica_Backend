-- ============================================================
-- Tabla: subscription_payments
-- Propósito: Historial de pagos que cada empresa hace por su suscripción
-- Depende de: subscriptions, companies
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    company_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'DOP',
    payment_method VARCHAR(50),
    reference VARCHAR(100),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_sub_payments_amount CHECK (amount > 0),
    CONSTRAINT chk_sub_payments_currency CHECK (currency IN ('DOP', 'USD')),
    CONSTRAINT chk_sub_payments_method CHECK (
        payment_method IS NULL OR 
        payment_method IN ('cash', 'transfer', 'card', 'stripe', 'paypal')
    ),
    CONSTRAINT chk_sub_payments_status CHECK (
        status IN ('pending', 'paid', 'failed', 'refunded')
    ),
    CONSTRAINT chk_sub_payments_period CHECK (period_end > period_start),

    -- Foreign Keys
    CONSTRAINT fk_sub_payments_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_payments_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription_id ON subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_company_id ON subscription_payments (company_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON subscription_payments (status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_paid_at ON subscription_payments (paid_at);
CREATE INDEX IF NOT EXISTS idx_sub_payments_period ON subscription_payments (period_start, period_end);

-- Comentarios
COMMENT ON TABLE subscription_payments IS 'Historial de pagos de suscripciones (registro contable)';
COMMENT ON COLUMN subscription_payments.subscription_id IS 'Suscripción que cubre este pago';
COMMENT ON COLUMN subscription_payments.company_id IS 'Empresa que realiza el pago (desnormalizado para consultas rápidas)';
COMMENT ON COLUMN subscription_payments.amount IS 'Monto del pago (siempre positivo)';
COMMENT ON COLUMN subscription_payments.currency IS 'Moneda: DOP o USD';
COMMENT ON COLUMN subscription_payments.payment_method IS 'Método: cash, transfer, card, stripe, paypal';
COMMENT ON COLUMN subscription_payments.reference IS 'Número de referencia o ID de transacción de la pasarela';
COMMENT ON COLUMN subscription_payments.period_start IS 'Inicio del período que cubre este pago';
COMMENT ON COLUMN subscription_payments.period_end IS 'Fin del período que cubre este pago';
COMMENT ON COLUMN subscription_payments.status IS 'Estado: pending, paid, failed, refunded';
COMMENT ON COLUMN subscription_payments.paid_at IS 'Fecha y hora del pago efectivo (NULL si no se ha pagado)';
COMMENT ON COLUMN subscription_payments.notes IS 'Notas internas (opcional)';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscription_payments'
ORDER BY ordinal_position;

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'subscription_payments'::regclass
  AND contype = 'f'
ORDER BY conname;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'subscription_payments'::regclass
  AND contype = 'c'
ORDER BY conname;

--test 
INSERT INTO subscription_payments (subscription_id, company_id, amount, period_start, period_end)
VALUES (
    (SELECT id FROM subscriptions LIMIT 1),
    (SELECT id FROM companies LIMIT 1),
    -100,
    now(),
    now() + INTERVAL '1 month'
);

INSERT INTO subscription_payments (subscription_id, company_id, amount, period_start, period_end)
VALUES (
    (SELECT id FROM subscriptions LIMIT 1),
    (SELECT id FROM companies LIMIT 1),
    1000,
    now(),
    now() - INTERVAL '1 day'
);
