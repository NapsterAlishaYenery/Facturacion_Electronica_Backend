-- ============================================================
-- Migración: invoice_lines — campos DGII faltantes
-- Propósito: agregar todos los campos del nodo <Item> del e-CF
--            que faltaban para cumplir con los XSD oficiales.
-- Fecha: 2026-10-24
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Backup de seguridad (por si algo sale mal)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_lines_backup_20261024
  AS SELECT * FROM invoice_lines;

-- ============================================================
-- 1. Nuevos campos OBLIGATORIOS (con default para no romper datos)
-- ============================================================

-- NombreItem (obligatorio DGII, máx 80 chars)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(80) NOT NULL DEFAULT 'Item';

-- IndicadorBienoServicio (obligatorio DGII: 1=Bien, 2=Servicio)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS indicador_bieno_servicio SMALLINT NOT NULL DEFAULT 1;

-- RecargoMonto (opcional DGII, default 0 para no romper)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS recargo DECIMAL(15,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Nuevos campos OPCIONALES (NULL por defecto)
-- ============================================================

-- UnidadMedida (código DGII 1-62, opcional)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS unidad_medida SMALLINT NULL;

-- CantidadReferencia / UnidadReferencia (opcionales)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS cantidad_referencia DECIMAL(15,4) NULL,
  ADD COLUMN IF NOT EXISTS unidad_referencia SMALLINT NULL;

-- GradosAlcohol (solo licores)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS grados_alcohol DECIMAL(5,2) NULL;

-- PrecioUnitarioReferencia (opcional)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS precio_unitario_referencia DECIMAL(15,2) NULL;

-- Fechas de elaboración / vencimiento (alimentos, medicinas)
ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS fecha_elaboracion DATE NULL,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_item DATE NULL;

-- ============================================================
-- 3. Ajustar description (era NOT NULL 500 → ahora NULL 1000)
--    description pasa a ser DescripcionItem (larga, opcional)
-- ============================================================

ALTER TABLE invoice_lines
  ALTER COLUMN description TYPE VARCHAR(1000),
  ALTER COLUMN description DROP NOT NULL;

-- ============================================================
-- 4. Rellenar item_name con lo que había en description
--    (para no dejar 'Item' genérico en datos viejos)
-- ============================================================

UPDATE invoice_lines
SET item_name = LEFT(description, 80)
WHERE item_name = 'Item' AND description IS NOT NULL;

-- ============================================================
-- 5. Constraints de validación
-- ============================================================

ALTER TABLE invoice_lines
  ADD CONSTRAINT chk_invoice_lines_indicador_bieno_servicio
    CHECK (indicador_bieno_servicio IN (1, 2)),
  ADD CONSTRAINT chk_invoice_lines_unidad_medida
    CHECK (unidad_medida IS NULL OR (unidad_medida BETWEEN 1 AND 62)),
  ADD CONSTRAINT chk_invoice_lines_unidad_referencia
    CHECK (unidad_referencia IS NULL OR (unidad_referencia BETWEEN 1 AND 62)),
  ADD CONSTRAINT chk_invoice_lines_grados_alcohol
    CHECK (grados_alcohol IS NULL OR (grados_alcohol BETWEEN 0 AND 100));

-- ============================================================
-- 6. Índice para filtrar bienes vs servicios
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_invoice_lines_bieno_servicio
  ON invoice_lines(indicador_bieno_servicio);

-- ============================================================
-- 7. Comentarios de documentación viva (tabla + columnas)
-- ============================================================

-- Columna item_name
COMMENT ON COLUMN invoice_lines.item_name IS
  'NombreItem DGII: nombre corto del bien/servicio. Obligatorio, máx 80 chars. Se escribe siempre en el XML.';

-- Columna indicador_bieno_servicio
COMMENT ON COLUMN invoice_lines.indicador_bieno_servicio IS
  'IndicadorBienoServicio DGII: 1=Bien, 2=Servicio. Obligatorio en todos los tipos de e-CF. Se escribe siempre en el XML.';

-- Columna unidad_medida
COMMENT ON COLUMN invoice_lines.unidad_medida IS
  'UnidadMedida DGII: código 1-62. NULL = no se envía (válido para servicios). Se escribe solo si tiene valor.';

-- Columna cantidad_referencia
COMMENT ON COLUMN invoice_lines.cantidad_referencia IS
  'CantidadReferencia DGII: cantidad de referencia del ítem (opcional). Requiere unidad_referencia para enviarse en XML.';

-- Columna unidad_referencia
COMMENT ON COLUMN invoice_lines.unidad_referencia IS
  'UnidadReferencia DGII: código 1-62 (opcional). Se envía junto con cantidad_referencia.';

-- Columna grados_alcohol
COMMENT ON COLUMN invoice_lines.grados_alcohol IS
  'GradosAlcohol DGII: solo aplica a licores. Se escribe en XML únicamente si el ítem es bebida alcohólica.';

-- Columna precio_unitario_referencia
COMMENT ON COLUMN invoice_lines.precio_unitario_referencia IS
  'PrecioUnitarioReferencia DGII: precio de referencia del ítem (opcional).';

-- Columna fecha_elaboracion
COMMENT ON COLUMN invoice_lines.fecha_elaboracion IS
  'FechaElaboracion DGII: fecha de elaboración (alimentos/medicinas). Opcional.';

-- Columna fecha_vencimiento_item
COMMENT ON COLUMN invoice_lines.fecha_vencimiento_item IS
  'FechaVencimientoItem DGII: fecha de vencimiento (alimentos/medicinas). Opcional.';

-- Columna recargo
COMMENT ON COLUMN invoice_lines.recargo IS
  'RecargoMonto DGII: monto de recargo por línea. Se escribe en XML solo si > 0.';

-- Columna description (actualizada)
COMMENT ON COLUMN invoice_lines.description IS
  'DescripcionItem DGII: descripción larga del ítem (máx 1000 chars). Opcional; se omite en XML si es NULL o vacía.';

-- Comentario global de la tabla
COMMENT ON TABLE invoice_lines IS
  'Líneas de detalle de facturas e-CF. Cada fila corresponde a un <Item> del XML DGII.';

COMMIT;

-- Ver columnas nuevas y sus comentarios
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  pgd.description AS comentario
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st
  ON st.relname = c.table_name
LEFT JOIN pg_catalog.pg_description pgd
  ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_name = 'invoice_lines'
ORDER BY c.ordinal_position;

SELECT COUNT(*) FILTER (WHERE item_name = 'Item') AS pendientes,
       COUNT(*) FILTER (WHERE item_name <> 'Item') AS migrados
FROM invoice_lines;