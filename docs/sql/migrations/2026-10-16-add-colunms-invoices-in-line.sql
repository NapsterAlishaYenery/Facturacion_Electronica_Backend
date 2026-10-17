-- ============================================================
-- Migración: desglose fiscal de totales + IndicadorFacturacion
-- Fecha: 2026-10-16
-- Propósito:
--   1. Agregar indicador_facturacion a invoice_lines (DGII 0-4)
--   2. Agregar desglose de totales a invoices (por tasa ITBIS)
--   3. Backward compat: datos viejos quedan con DEFAULT 0
-- ============================================================

-- ============================================================
-- 1. invoice_lines: indicador_facturacion
-- ============================================================
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS indicador_facturacion SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_indicador_facturacion
        CHECK (indicador_facturacion IN (0, 1, 2, 3, 4));

COMMENT ON COLUMN invoice_lines.indicador_facturacion IS
    'DGII IndicadorFacturacion: 0=No Facturable, 1=ITBIS 18%, 2=ITBIS 16%, 3=ITBIS 3 (0%), 4=Exento';

-- ============================================================
-- 2. invoices: desglose de totales por tasa
-- ============================================================
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_gravado DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itbis1_base DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itbis1_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itbis2_base DECIMAL(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itbis2_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- itbis3_base / itbis3_amount / exempt_amount YA EXISTEN (migración 2026-09-29)
-- total_itbis_retenido / total_isr_retencion YA EXISTEN

-- Constraints
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_monto_gravado
        CHECK (monto_gravado >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_itbis1_base
        CHECK (itbis1_base >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_itbis1_amount
        CHECK (itbis1_amount >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_itbis2_base
        CHECK (itbis2_base >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_itbis2_amount
        CHECK (itbis2_amount >= 0);

-- ============================================================
-- 3. Comentarios
-- ============================================================
COMMENT ON COLUMN invoices.monto_gravado IS
    'Total de la base gravada (itbis1_base + itbis2_base + itbis3_base). NO incluye exento.';

COMMENT ON COLUMN invoices.itbis1_base IS
    'Base gravada a ITBIS 18% (IndicadorFacturacion=1)';

COMMENT ON COLUMN invoices.itbis1_amount IS
    'ITBIS 18% calculado sobre itbis1_base';

COMMENT ON COLUMN invoices.itbis2_base IS
    'Base gravada a ITBIS 16% (IndicadorFacturacion=2)';

COMMENT ON COLUMN invoices.itbis2_amount IS
    'ITBIS 16% calculado sobre itbis2_base';

-- ============================================================
-- 4. Verificación
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN (
    'monto_gravado',
    'itbis1_base', 'itbis1_amount',
    'itbis2_base', 'itbis2_amount',
    'itbis3_base', 'itbis3_amount',
    'exempt_amount'
  )
ORDER BY column_name;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoice_lines'
  AND column_name = 'indicador_facturacion';