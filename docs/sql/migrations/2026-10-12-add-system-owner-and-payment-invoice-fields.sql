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

SELECT invoice_id, COUNT(*) AS cnt
FROM subscription_payments
WHERE invoice_id IS NOT NULL
GROUP BY invoice_id
HAVING COUNT(*) > 1;

-- ============================================================
-- Migration: Unique constraint on subscription_payments.invoice_id
-- Date: 2026-10-13
-- Purpose:
--   Enforce 1:1 relationship between a payment and its
--   membership invoice. Prevents duplicate invoices when
--   createMembershipInvoice is retried.
--   NULL is allowed multiple times (payments without invoice).
-- Depends on: 2026-10-12 migration (fk_subscription_payments_invoice)
-- ============================================================

ALTER TABLE subscription_payments
    ADD CONSTRAINT uq_subscription_payments_invoice_id
        UNIQUE (invoice_id);

COMMENT ON CONSTRAINT uq_subscription_payments_invoice_id
    ON subscription_payments IS
    'One membership invoice per payment. NULL = not yet invoiced.';


    -- ============================================================
-- Migration: Track invoice generation attempts for payments
-- Date: 2026-10-13
-- Purpose:
--   Allow the membership-invoice-reconciliation job to count
--   failed attempts and stop retrying after N failures.
--   After MAX_ATTEMPTS, the job alerts ExpediNap and stops.
-- Depends on: 2026-10-13 migration (uq_subscription_payments_invoice_id)
-- ============================================================

ALTER TABLE subscription_payments
    ADD COLUMN IF NOT EXISTS invoice_generation_attempts INT NOT NULL DEFAULT 0;

ALTER TABLE subscription_payments
    ADD COLUMN IF NOT EXISTS last_invoice_attempt_at TIMESTAMP;

COMMENT ON COLUMN subscription_payments.invoice_generation_attempts IS
    'Failed attempts to generate the membership invoice. Reset to 0 on success.';

COMMENT ON COLUMN subscription_payments.last_invoice_attempt_at IS
    'Timestamp of the last attempt to generate the membership invoice.';

CREATE INDEX IF NOT EXISTS idx_sub_payments_invoice_pending
    ON subscription_payments (status, invoice_id, invoice_generation_attempts)
    WHERE status = 'paid' AND invoice_id IS NULL;

	SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscription_payments'
  AND column_name IN ('invoice_generation_attempts', 'last_invoice_attempt_at');
