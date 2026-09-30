-- ============================================================
-- Tabla: invoices
-- Propósito: Facturas electrónicas (e-CF) emitidas por cada empresa
-- Depende de: companies, sequences
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    sequence_id UUID NOT NULL,
    type VARCHAR(2) NOT NULL,
    ncf VARCHAR(20) NOT NULL,
    track_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    xml_content TEXT,
    xml_signed TEXT,
    dgii_response JSONB,
    issuer_rnc VARCHAR(15) NOT NULL,
    issuer_name VARCHAR(200) NOT NULL,
    receiver_rnc VARCHAR(15),
    receiver_name VARCHAR(200),
    subtotal DECIMAL(15,2) NOT NULL,
    itbis DECIMAL(15,2) NOT NULL DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    issued_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_invoices_type CHECK (
        type IN ('31', '32', '33', '34', '41', '43', '44', '45', '46', '47')
    ),
    CONSTRAINT chk_invoices_status CHECK (
        status IN ('draft', 'signed', 'sent', 'accepted', 'rejected', 'contingency')
    ),
    CONSTRAINT chk_invoices_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_invoices_itbis CHECK (itbis >= 0),
    CONSTRAINT chk_invoices_total CHECK (total >= 0),

    -- Unique: una empresa no puede repetir NCF
    CONSTRAINT uq_invoices_company_ncf UNIQUE (company_id, ncf),

    -- Foreign Keys
    CONSTRAINT fk_invoices_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoices_sequence
        FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE RESTRICT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sequence_id ON invoices (sequence_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_track_id ON invoices (track_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ncf ON invoices (ncf);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON invoices (issued_at);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices (company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_issued ON invoices (company_id, issued_at);

-- Comentarios
COMMENT ON TABLE invoices IS 'Facturas electrónicas (e-CF) emitidas por cada empresa';
COMMENT ON COLUMN invoices.company_id IS 'Empresa que emite la factura';
COMMENT ON COLUMN invoices.sequence_id IS 'Secuencia e-NCF de la que se tomó el número';
COMMENT ON COLUMN invoices.type IS 'Tipo de e-CF: 31, 32, 33, 34, 41, 43, 44, 45, 46, 47';
COMMENT ON COLUMN invoices.ncf IS 'Número completo del e-NCF (ej: E320000000001)';
COMMENT ON COLUMN invoices.track_id IS 'TrackId devuelto por DGII al recibir el e-CF';
COMMENT ON COLUMN invoices.status IS 'Estado: draft, signed, sent, accepted, rejected, contingency';
COMMENT ON COLUMN invoices.xml_content IS 'XML generado sin firmar (para referencia)';
COMMENT ON COLUMN invoices.xml_signed IS 'XML firmado digitalmente (NUNCA modificar)';
COMMENT ON COLUMN invoices.dgii_response IS 'Respuesta completa de DGII en formato JSON';
COMMENT ON COLUMN invoices.issuer_rnc IS 'RNC del emisor (desnormalizado para consultas rápidas)';
COMMENT ON COLUMN invoices.issuer_name IS 'Razón social del emisor (desnormalizado)';
COMMENT ON COLUMN invoices.receiver_rnc IS 'RNC del comprador (NULL para consumidor final)';
COMMENT ON COLUMN invoices.receiver_name IS 'Nombre del comprador (NULL para consumidor final)';
COMMENT ON COLUMN invoices.subtotal IS 'Subtotal antes de impuestos';
COMMENT ON COLUMN invoices.itbis IS 'Monto total de ITBIS';
COMMENT ON COLUMN invoices.total IS 'Total de la factura';
COMMENT ON COLUMN invoices.issued_at IS 'Fecha y hora de emisión de la factura';


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

    -- Si el tipo NO es 33 ni 34, los campos de referencia deben ser NULL
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_non_notas_no_reference ...


    -- Ver las columnas nuevas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN (
    'modified_ncf', 'modified_ncf_issuer_rnc', 'modified_ncf_date',
    'modification_code', 'modification_reason', 'indicador_nota_credito'
  )
ORDER BY column_name;

-- Ver las constraints nuevas
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'invoices'::regclass
  AND conname LIKE 'chk_invoices_%'
ORDER BY conname;