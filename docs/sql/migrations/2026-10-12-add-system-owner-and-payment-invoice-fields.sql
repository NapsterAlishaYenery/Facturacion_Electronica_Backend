-- ============================================================
-- Migration: Add system owner flag + payment → invoice link
-- Date: 2026-10-12
-- Purpose:
--   1. Mark the SaaS owner company (ExpediNap) so it can
--      bypass subscription checks when issuing invoices.
--   2. Link subscription payments to the invoices generated
--      for membership sales (ExpediNap → client companies).
-- ============================================================

-- ------------------------------------------------------------
-- 1. companies.is_system_owner
-- ------------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS is_system_owner BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_is_system_owner
    ON companies (is_system_owner)
    WHERE is_system_owner = true;

COMMENT ON COLUMN companies.is_system_owner IS
    'True only for the SaaS owner company (ExpediNap). Bypasses subscription checks when issuing invoices.';

-- ------------------------------------------------------------
-- 2. subscription_payments.invoice_id
-- ------------------------------------------------------------
ALTER TABLE subscription_payments
    ADD COLUMN IF NOT EXISTS invoice_id UUID;

ALTER TABLE subscription_payments
    ADD CONSTRAINT fk_subscription_payments_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_invoice_id
    ON subscription_payments (invoice_id);

COMMENT ON COLUMN subscription_payments.invoice_id IS
    'Invoice issued by the SaaS owner (ExpediNap) for this membership payment. NULL if not yet generated.';

-- ------------------------------------------------------------
-- 3. Mark ExpediNap as system owner
-- ------------------------------------------------------------
UPDATE companies
SET is_system_owner = true
WHERE rnc = '02800918407'
  AND name = 'ExpediNap';

-- ------------------------------------------------------------
-- 4. Extend ExpediNap sequence 31 expiration (test data fix)
-- ------------------------------------------------------------
UPDATE sequences
SET expires_at = '2027-12-31 23:59:59'
WHERE id = '400dfd07-51d4-4e2c-96a5-8f06b1067ab1';

-- ------------------------------------------------------------
-- 5. Delete ExpediNap trial subscription (it should not have one)
-- ------------------------------------------------------------
DELETE FROM subscription_payments
WHERE subscription_id IN (
    SELECT id FROM subscriptions
    WHERE company_id = 'fb187614-0412-4d82-ae96-283a0394ae84'
);

DELETE FROM subscriptions
WHERE company_id = 'fb187614-0412-4d82-ae96-283a0394ae84';