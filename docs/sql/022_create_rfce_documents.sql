BEGIN;

CREATE TABLE IF NOT EXISTS rfce_documents (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID        NOT NULL,

    -- XML del RFCE (sin firmar y firmado)
    xml_content         TEXT        NULL,
    xml_signed          TEXT        NULL,

    -- Código de seguridad (6 chars del SignatureValue del e-CF 32 firmado)
    -- Placeholder '000000' hasta que se firme el e-CF
    codigo_seguridad    VARCHAR(6)  NULL,

    -- Ciclo de vida del RFCE
    status              VARCHAR(20) NOT NULL DEFAULT 'draft',
    track_id            VARCHAR(50) NULL,
    dgii_response       JSONB       NULL,
    send_attempts       INTEGER     NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_rfce_documents_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_rfce_status
        CHECK (status IN ('draft', 'signed', 'sent', 'accepted', 'rejected')),

    CONSTRAINT chk_rfce_codigo_seguridad
        CHECK (codigo_seguridad IS NULL OR length(codigo_seguridad) = 6),

    CONSTRAINT chk_rfce_send_attempts
        CHECK (send_attempts >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rfce_documents_invoice_id
    ON rfce_documents (invoice_id);

CREATE INDEX IF NOT EXISTS idx_rfce_documents_status
    ON rfce_documents (status);

CREATE INDEX IF NOT EXISTS idx_rfce_documents_track_id
    ON rfce_documents (track_id);

COMMENT ON TABLE rfce_documents IS 'DT39 — Resumen de Factura de Consumo (RFCE) por invoice. Solo aplica a type=32 con total < 250,000.';
COMMENT ON COLUMN rfce_documents.codigo_seguridad IS '6 primeros chars del SignatureValue del e-CF 32 firmado. Placeholder 000000 hasta firmar.';
COMMENT ON COLUMN rfce_documents.xml_content IS 'XML del RFCE sin firmar (auditoría)';
COMMENT ON COLUMN rfce_documents.xml_signed IS 'XML del RFCE firmado (listo para enviar a DGII)';

COMMIT;