-- Antes de aplicar la migración, verifica data sucia:
SELECT id, rnc, name, economic_activity
FROM companies
WHERE economic_activity IS NOT NULL
  AND economic_activity <> ''
  AND economic_activity !~ '^\d{1,6}$';
-- ============================================================
-- Migración: descripción de actividad económica en companies
-- Fecha: 2026-11-07
-- Depende de: companies (Fase 1)
--
-- Estrategia:
--   1. Agregar columna nueva `economic_activity_description`.
--   2. Copiar el valor actual de `economic_activity` a la nueva
--      columna (para no perder el texto libre existente).
--   3. Asignar códigos DGII a cada empresa conocida.
--   4. Dejar el CHECK para que `economic_activity` solo acepte
--      códigos numéricos (1-6 dígitos) o NULL/vacío.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columna de descripción (nullable)
-- ------------------------------------------------------------
  ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS economic_activity_description VARCHAR(200);

COMMENT ON COLUMN companies.economic_activity IS
    'Código numérico de actividad económica DGII (1-6 dígitos). Se envía en <ActividadEconomica> del XML.';

COMMENT ON COLUMN companies.economic_activity_description IS
    'Nombre legible de la actividad económica. SOLO para el front. NO se envía a DGII.';


	-- ------------------------------------------------------------
-- 2. Copiar el valor actual a la nueva columna de descripción
--    (preserva el texto libre existente antes de tocar el código)
-- ------------------------------------------------------------
UPDATE companies
SET economic_activity_description = economic_activity
WHERE economic_activity_description IS NULL
  AND economic_activity IS NOT NULL
  AND economic_activity <> '';


  -- ------------------------------------------------------------
-- 3. Asignar códigos DGII a cada empresa conocida
--    (usa el RNC como identificador; ajusta si hace falta)
-- ------------------------------------------------------------
-- DBZ — Comercial
UPDATE companies
SET economic_activity = '466301',
    economic_activity_description = 'COMERCIO AL POR MAYOR DE OTROS PRODUCTOS'
WHERE rnc = '13006904627';

-- hadassa05 celebraciones celestiales — Asesoría Legal
UPDATE companies
SET economic_activity = '691001',
    economic_activity_description = 'ACTIVIDADES JURÍDICAS'
WHERE rnc = '133460289';

-- ExpediNap — Diseño y desarrollo de software
UPDATE companies
SET economic_activity = '729201',
    economic_activity_description = 'DISEÑO Y DESARROLLO DE SOFTWARE'
WHERE rnc = '02800918407';

-- Test Company SAS — Comercio al por menor
UPDATE companies
SET economic_activity = '471101',
    economic_activity_description = 'COMERCIO AL POR MENOR EN ALMACENES'
WHERE rnc = '131880659';

-- Inversiones del Caribe SRL — Ventas de tecnología al por menor
UPDATE companies
SET economic_activity = '474101',
    economic_activity_description = 'VENTA AL POR MENOR DE EQUIPOS DE TELECOMUNICACIONES'
WHERE rnc = '131456789';


-- ------------------------------------------------------------
-- 4. Constraint de formato para el código DGII
--    Solo dígitos 1-6, NULL o vacío.
--    (Se aplica al final, cuando ya no hay texto libre.)
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_companies_economic_activity_code'
          AND conrelid = 'companies'::regclass
    ) THEN
        ALTER TABLE companies
            ADD CONSTRAINT chk_companies_economic_activity_code
            CHECK (
                economic_activity IS NULL
                OR economic_activity = ''
                OR economic_activity ~ '^\d{1,6}$'
            );
    END IF;
END $$;


SELECT id, rnc, name, economic_activity
FROM companies
WHERE rnc IN (
    '13006904627', '133460289', '02800918407',
    '131880659', '131456789'
);