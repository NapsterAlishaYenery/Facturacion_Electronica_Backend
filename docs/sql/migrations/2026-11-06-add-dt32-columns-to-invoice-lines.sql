-- ============================================================
-- DT32 — Refactor subtotales: agregar subtotal_id a invoice_lines
-- ============================================================
-- Esta columna indica a qué grupo de subtotal pertenece cada línea.
-- NULL = la línea no entra en ningún subtotal (válido).
-- 1..20 = número del subtotal al que pertenece.
-- ============================================================

BEGIN;

-- 1. Agregar la columna (nullable, sin default)
ALTER TABLE invoice_lines
    ADD COLUMN subtotal_id SMALLINT NULL;

-- 2. Agregar constraint de rango (1-20) si no es NULL
ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_subtotal_id
    CHECK (subtotal_id IS NULL OR (subtotal_id >= 1 AND subtotal_id <= 20));

-- 3. Índice para acelerar el cálculo de subtotales
CREATE INDEX idx_invoice_lines_invoice_subtotal
    ON invoice_lines (invoice_id, subtotal_id);

-- 4. Comentario de la columna
COMMENT ON COLUMN invoice_lines.subtotal_id IS
    'Número del subtotal (1-20) al que pertenece esta línea. NULL = no entra en ningún subtotal. Usado para calcular <Subtotales> del XML DGII.';

COMMIT;