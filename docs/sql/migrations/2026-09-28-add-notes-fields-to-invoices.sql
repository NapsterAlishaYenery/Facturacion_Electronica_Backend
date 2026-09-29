-- ============================================================
-- Migración: campos de Notas de Débito/Crédito (33/34) en invoices
-- Fecha: 2026-09-28
-- Depende de: invoices (creada en Fase 1)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columnas (todas nullable por defecto)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS modified_ncf VARCHAR(20),
    ADD COLUMN IF NOT EXISTS modified_ncf_issuer_rnc VARCHAR(15),
    ADD COLUMN IF NOT EXISTS modified_ncf_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS modification_code SMALLINT,
    ADD COLUMN IF NOT EXISTS modification_reason VARCHAR(90),
    ADD COLUMN IF NOT EXISTS indicador_nota_credito SMALLINT;

-- ------------------------------------------------------------
-- 2. Constraints de rango
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_modification_code
        CHECK (modification_code IS NULL OR (modification_code BETWEEN 1 AND 5));

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_nota_credito
        CHECK (indicador_nota_credito IS NULL OR (indicador_nota_credito IN (0, 1)));

-- ------------------------------------------------------------
-- 3. Constraints lógicas de negocio
-- ------------------------------------------------------------

-- Si el tipo es 33 o 34, los campos de referencia son OBLIGATORIOS
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_notas_require_reference
        CHECK (
            type NOT IN ('33', '34')
            OR (
                modified_ncf IS NOT NULL
                AND modified_ncf_date IS NOT NULL
                AND modification_code IS NOT NULL
            )
        );

-- Si el tipo NO es 33 ni 34, los campos de referencia deben ser NULL
-- (defensa contra data sucia: un 32 no puede tener modified_ncf)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_non_notas_no_reference
        CHECK (
            type IN ('33', '34')
            OR (
                modified_ncf IS NULL
                AND modified_ncf_date IS NULL
                AND modification_code IS NULL
                AND modification_reason IS NULL
                AND modified_ncf_issuer_rnc IS NULL
            )
        );

-- El indicadorNotaCredito SOLO puede estar en el tipo 34
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_solo_34
        CHECK (indicador_nota_credito IS NULL OR type = '34');

-- ------------------------------------------------------------
-- 4. Índice para búsquedas
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_modified_ncf
    ON invoices (modified_ncf);

CREATE INDEX IF NOT EXISTS idx_invoices_company_type_modified
    ON invoices (company_id, type, modified_ncf);

-- ------------------------------------------------------------
-- 5. Comentarios
-- ------------------------------------------------------------
COMMENT ON COLUMN invoices.modified_ncf IS
    'NCF de la factura original que esta nota modifica (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modified_ncf_issuer_rnc IS
    'RNC del emisor de la factura original (opcional, AlfNum15)';

COMMENT ON COLUMN invoices.modified_ncf_date IS
    'Fecha de emisión de la factura original (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_code IS
    'Código de modificación: 1=anula, 2=corrige texto, 3=corrige montos, 4=reemplazo contingencia, 5=referencia FC (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_reason IS
    'Razón de la modificación (opcional, AlfNum90)';

COMMENT ON COLUMN invoices.indicador_nota_credito IS
    'Solo 34: 0=fecha original <=30 días, 1=fecha original >30 días';