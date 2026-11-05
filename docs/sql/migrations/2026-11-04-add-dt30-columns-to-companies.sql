-- ============================================================
-- DT30 — Migración: campos adicionales de Emisor
-- Tabla: companies
-- Fecha: 2026-11-04
-- Propósito: Alinear <Emisor> del XML con el PDF DGII v1.0
--            (DT30 — Encabezado completo del e-CF)
-- Afecta: companies
-- Rollback: ver al final del archivo
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. <Sucursal> (opcional, 31-47)
--    STRING(20) según el DT30
-- ------------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS sucursal VARCHAR(20) NULL;

COMMENT ON COLUMN companies.sucursal
    IS 'DT30: <Sucursal> — código o nombre de sucursal (opcional, máx 20 chars)';


-- ------------------------------------------------------------
-- 2. <WebSite> (opcional, 31-47)
--    STRING(50) según el DT30
-- ------------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS website VARCHAR(50) NULL;

COMMENT ON COLUMN companies.website
    IS 'DT30: <WebSite> — URL del sitio web de la empresa (opcional, máx 50 chars)';


-- ------------------------------------------------------------
-- 3. <TablaTelefonoEmisor> hasta 3 repeticiones
--    La columna phone YA EXISTE y representa el 1er teléfono.
--    additional_phones guarda hasta 2 teléfonos extra.
--    Formato: JSONB array de strings → ["809-555-1234", "829-555-5678"]
-- ------------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS additional_phones JSONB NULL;

COMMENT ON COLUMN companies.additional_phones
    IS 'DT30: <TablaTelefonoEmisor> — array JSON de hasta 2 teléfonos adicionales al campo phone. Formato: ["809-555-1234", "829-555-5678"]';


-- ------------------------------------------------------------
-- 4. Constraint: additional_phones debe ser un array de máx 2 strings
-- ------------------------------------------------------------
ALTER TABLE companies
    ADD CONSTRAINT chk_companies_additional_phones
    CHECK (
        additional_phones IS NULL
        OR (
            jsonb_typeof(additional_phones) = 'array'
            AND jsonb_array_length(additional_phones) <= 2
        )
    );


-- ------------------------------------------------------------
-- 5. Índice GIN (para consultas futuras por teléfono)
--    Opcional pero recomendado para JSONB
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_companies_additional_phones
    ON companies USING GIN (additional_phones);


COMMIT;

-- ============================================================
-- ROLLBACK (por si necesitas revertir)
-- ============================================================
-- BEGIN;
--   DROP INDEX IF EXISTS idx_companies_additional_phones;
--   ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_companies_additional_phones;
--   ALTER TABLE companies DROP COLUMN IF EXISTS additional_phones;
--   ALTER TABLE companies DROP COLUMN IF EXISTS website;
--   ALTER TABLE companies DROP COLUMN IF EXISTS sucursal;
-- COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- SELECT column_name, data_type, character_maximum_length, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'companies'
--   AND column_name IN ('sucursal', 'website', 'additional_phones')
-- ORDER BY column_name;