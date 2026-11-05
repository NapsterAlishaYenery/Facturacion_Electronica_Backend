-- ============================================================
-- DT30 — Migración: <OtraMonedaDetalle> por línea de factura
-- Tabla: invoice_lines
-- Fecha: 2026-11-04
-- Propósito: Alinear <Item><OtraMonedaDetalle> del XML con el
--            PDF DGII v1.0 (DT30 + DT31)
-- Afecta: invoice_lines
-- Rollback: ver al final del archivo
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. <PrecioOtraMoneda> — DECIMAL(15,4)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS precio_otra_moneda DECIMAL(15, 4) NULL;

COMMENT ON COLUMN invoice_lines.precio_otra_moneda
    IS 'DT30: <PrecioOtraMoneda> — precio unitario en moneda extranjera (solo si la factura usa OtraMoneda)';


-- ------------------------------------------------------------
-- 2. <DescuentoOtraMoneda> — DECIMAL(15,2)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS descuento_otra_moneda DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoice_lines.descuento_otra_moneda
    IS 'DT30: <DescuentoOtraMoneda> — descuento de la línea en moneda extranjera';


-- ------------------------------------------------------------
-- 3. <RecargoOtraMoneda> — DECIMAL(15,2)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS recargo_otra_moneda DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoice_lines.recargo_otra_moneda
    IS 'DT30: <RecargoOtraMoneda> — recargo de la línea en moneda extranjera';


-- ------------------------------------------------------------
-- 4. <MontoItemOtraMoneda> — DECIMAL(15,2)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS monto_item_otra_moneda DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoice_lines.monto_item_otra_moneda
    IS 'DT30: <MontoItemOtraMoneda> — total de la línea en moneda extranjera';


-- ------------------------------------------------------------
-- 5. Constraints: valores no negativos (excepto precio, que puede ser >= 0)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_precio_otra_moneda
    CHECK (precio_otra_moneda IS NULL OR precio_otra_moneda >= 0);

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_descuento_otra_moneda
    CHECK (descuento_otra_moneda IS NULL OR descuento_otra_moneda >= 0);

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_recargo_otra_moneda
    CHECK (recargo_otra_moneda IS NULL OR recargo_otra_moneda >= 0);

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_monto_item_otra_moneda
    CHECK (monto_item_otra_moneda IS NULL OR monto_item_otra_moneda >= 0);


COMMIT;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
--   ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_invoice_lines_monto_item_otra_moneda;
--   ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_invoice_lines_recargo_otra_moneda;
--   ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_invoice_lines_descuento_otra_moneda;
--   ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS chk_invoice_lines_precio_otra_moneda;
--   ALTER TABLE invoice_lines DROP COLUMN IF EXISTS monto_item_otra_moneda;
--   ALTER TABLE invoice_lines DROP COLUMN IF EXISTS recargo_otra_moneda;
--   ALTER TABLE invoice_lines DROP COLUMN IF EXISTS descuento_otra_moneda;
--   ALTER TABLE invoice_lines DROP COLUMN IF EXISTS precio_otra_moneda;
-- COMMIT;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'invoice_lines'
--   AND column_name LIKE '%otra_moneda'
-- ORDER BY column_name;