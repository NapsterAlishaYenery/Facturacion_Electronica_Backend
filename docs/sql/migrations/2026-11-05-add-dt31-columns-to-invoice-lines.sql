-- ============================================================
-- DT31 — Migración: campos adicionales del <Item>
-- Tabla: invoice_lines
-- Fecha: 2026-11-05
-- Propósito: Alinear <DetallesItem>/<Item> con el PDF DGII v1.0
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. <TablaCodigosItem> (hasta 5 códigos por ítem)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS additional_codes JSONB NULL;

COMMENT ON COLUMN invoice_lines.additional_codes
    IS 'DT31: <TablaCodigosItem> — array JSON [{tipoCodigo:"Interna"|"EAN"|"PLU"|"DUN", codigoItem:"..."}] máx 5.';


-- ------------------------------------------------------------
-- 2. <TablaSubcantidad> (hasta 5 por ítem)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS subcantidades JSONB NULL;

COMMENT ON COLUMN invoice_lines.subcantidades
    IS 'DT31: <TablaSubcantidad> — array JSON [{subcantidad:number, codigoSubcantidad:1-62}] máx 5.';


-- ------------------------------------------------------------
-- 3. <TablaSubDescuento> (hasta 12 por ítem)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS sub_descuentos JSONB NULL;

COMMENT ON COLUMN invoice_lines.sub_descuentos
    IS 'DT31: <TablaSubDescuento> — array JSON [{tipoSubDescuento:"$"|"%", subDescuentoPorcentaje?, montoSubDescuento}] máx 12.';


-- ------------------------------------------------------------
-- 4. <TablaSubRecargo> (hasta 12 por ítem)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS sub_recargos JSONB NULL;

COMMENT ON COLUMN invoice_lines.sub_recargos
    IS 'DT31: <TablaSubRecargo> — array JSON [{tipoSubRecargo:"$"|"%", subRecargoPorcentaje?, montoSubRecargo}] máx 12.';


-- ------------------------------------------------------------
-- 5. <TablaImpuestoAdicional> (hasta 2 por ítem)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS impuestos_adicionales JSONB NULL;

COMMENT ON COLUMN invoice_lines.impuestos_adicionales
    IS 'DT31: <TablaImpuestoAdicional> — array JSON [{codigo:"001"-"039"}] máx 2.';


-- ------------------------------------------------------------
-- 6-9. <Mineria> (solo 32, 33, 34, 46)
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS peso_neto_kilogramo DECIMAL(19, 3) NULL;

ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS peso_neto_mineria DECIMAL(19, 3) NULL;

ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS tipo_afiliacion SMALLINT NULL;

ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS liquidacion SMALLINT NULL;

COMMENT ON COLUMN invoice_lines.peso_neto_kilogramo
    IS 'DT31: <PesoNetoKilogramo> — solo tipos 32, 33, 34, 46.';
COMMENT ON COLUMN invoice_lines.peso_neto_mineria
    IS 'DT31: <PesoNetoMineria> — solo tipos 32, 33, 34, 46.';
COMMENT ON COLUMN invoice_lines.tipo_afiliacion
    IS 'DT31: <TipoAfiliacion> — 1 o 2. Solo tipos 32, 33, 34, 46.';
COMMENT ON COLUMN invoice_lines.liquidacion
    IS 'DT31: <Liquidacion> — 1 o 2. Solo tipos 32, 33, 34, 46.';


-- ------------------------------------------------------------
-- 10. Constraints de mineria
-- ------------------------------------------------------------
ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_tipo_afiliacion
    CHECK (tipo_afiliacion IS NULL OR tipo_afiliacion IN (1, 2));

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_liquidacion
    CHECK (liquidacion IS NULL OR liquidacion IN (1, 2));


COMMIT;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'invoice_lines'
--   AND column_name IN (
--     'additional_codes','subcantidades','sub_descuentos','sub_recargos',
--     'impuestos_adicionales','peso_neto_kilogramo','peso_neto_mineria',
--     'tipo_afiliacion','liquidacion'
--   )
-- ORDER BY column_name;