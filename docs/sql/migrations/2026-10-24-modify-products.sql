-- ============================================================
-- Migración: products — campos DGII para multi-rubro
-- Propósito: soportar bienes físicos y servicios, y los campos
--            opcionales que la DGII pide según el tipo de ítem
--            (licores, alimentos, medicinas, referencias).
-- Fecha: 2026-10-24
-- ============================================================

BEGIN;

-- Backup rápido
CREATE TABLE IF NOT EXISTS products_backup_20261024
  AS SELECT * FROM products;

-- ============================================================
-- 1. Quitar ITBIS_3_46 del constraint de tax_type (Decisión 2)
-- ============================================================
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_tax_type_check;

ALTER TABLE products
  ADD CONSTRAINT products_tax_type_check
    CHECK (tax_type IN ('ITBIS_18', 'ITBIS_16', 'EXENTO'));

-- Si algún producto tuviera ITBIS_3_46 (no debería en MVP), lo migramos
UPDATE products
SET tax_type = 'EXENTO'
WHERE tax_type = 'ITBIS_3_46';

-- ============================================================
-- 2. Campos nuevos: naturaleza del ítem + unidades + referencias
-- ============================================================

-- 2.1 Indicador Bien/Servicio (crítico DGII)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS indicador_bieno_servicio SMALLINT
    NOT NULL DEFAULT 1
    CHECK (indicador_bieno_servicio IN (1, 2));

-- 2.2 Unidad de medida (código DGII 1-62)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unidad_medida SMALLINT
    CHECK (unidad_medida IS NULL OR (unidad_medida BETWEEN 1 AND 62));

-- 2.3 Grados alcohol (solo licores)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS grados_alcohol DECIMAL(5, 2)
    CHECK (grados_alcohol IS NULL OR (grados_alcohol BETWEEN 0 AND 100));

-- 2.4 Fechas (solo alimentos/medicinas)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fecha_elaboracion DATE;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_item DATE;

-- 2.5 Referencias (opcional)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cantidad_referencia DECIMAL(15, 4)
    CHECK (cantidad_referencia IS NULL OR cantidad_referencia >= 0);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unidad_referencia SMALLINT
    CHECK (unidad_referencia IS NULL OR (unidad_referencia BETWEEN 1 AND 62));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS precio_unitario_referencia DECIMAL(15, 2)
    CHECK (precio_unitario_referencia IS NULL OR precio_unitario_referencia >= 0);

-- ============================================================
-- 3. Comentarios de documentación viva
-- ============================================================
COMMENT ON COLUMN products.indicador_bieno_servicio IS
  'IndicadorBienoServicio DGII: 1=Bien, 2=Servicio. Obligatorio.';

COMMENT ON COLUMN products.unidad_medida IS
  'UnidadMedida DGII: código 1-62. Requerido si es bien; NULL si es servicio.';

COMMENT ON COLUMN products.grados_alcohol IS
  'GradosAlcohol DGII: solo licores (bien). NULL en otros casos.';

COMMENT ON COLUMN products.fecha_elaboracion IS
  'FechaElaboracion DGII: alimentos/medicinas. Opcional.';

COMMENT ON COLUMN products.fecha_vencimiento_item IS
  'FechaVencimientoItem DGII: alimentos/medicinas. Opcional.';

COMMENT ON COLUMN products.cantidad_referencia IS
  'CantidadReferencia DGII: opcional. Requiere unidad_referencia.';

COMMENT ON COLUMN products.unidad_referencia IS
  'UnidadReferencia DGII: código 1-62. Requiere cantidad_referencia.';

COMMENT ON COLUMN products.precio_unitario_referencia IS
  'PrecioUnitarioReferencia DGII: opcional.';

-- ============================================================
-- 4. Índice para filtrar bienes vs servicios (útil en POS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_company_bieno_servicio
  ON products (company_id, indicador_bieno_servicio);

COMMIT;




-- 1. Confirmar columnas nuevas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 2. Confirmar que el constraint de tax_type ya no admite ITBIS_3_46
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'products'::regclass
  AND conname LIKE '%tax_type%';

-- 3. Confirmar que los productos existentes quedaron con indicadorBienoServicio = 1
SELECT COUNT(*) FILTER (WHERE indicador_bieno_servicio = 1) AS bienes,
       COUNT(*) FILTER (WHERE indicador_bieno_servicio = 2) AS servicios
FROM products;