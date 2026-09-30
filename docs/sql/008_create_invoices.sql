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

