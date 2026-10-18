-- ============================================================
-- Tabla: company_logos
-- Propósito: Logos de empresas (invoice y dashboard)
-- Fase: 16.x (feature de branding)
-- Fecha: 2026-10-17
-- ============================================================

CREATE TABLE IF NOT EXISTS company_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL
        REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    purpose VARCHAR(20) NOT NULL DEFAULT 'invoice'
        CHECK (purpose IN ('invoice', 'dashboard')),
    public_id VARCHAR(300) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secure_url VARCHAR(500) NOT NULL,
    format VARCHAR(10),
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_logos_company_purpose UNIQUE (company_id, purpose)
);

-- ============================================================
-- Comentarios (documentación viva de la BD)
-- ============================================================
COMMENT ON TABLE company_logos IS 'Logos de empresas para facturas (invoice) y dashboard (dashboard)';
COMMENT ON COLUMN company_logos.company_id IS 'Empresa dueña del logo (FK a companies)';
COMMENT ON COLUMN company_logos.purpose IS 'Uso del logo: invoice (facturas) o dashboard (UI)';
COMMENT ON COLUMN company_logos.public_id IS 'ID de Cloudinary, necesario para borrar/sobrescribir';
COMMENT ON COLUMN company_logos.url IS 'URL http devuelta por Cloudinary';
COMMENT ON COLUMN company_logos.secure_url IS 'URL https devuelta por Cloudinary (usar esta en templates)';
COMMENT ON COLUMN company_logos.format IS 'Formato: png, jpg, svg, webp';
COMMENT ON COLUMN company_logos.width IS 'Ancho en píxeles (0 si Cloudinary no lo devuelve, ej. svg)';
COMMENT ON COLUMN company_logos.height IS 'Alto en píxeles (0 si Cloudinary no lo devuelve, ej. svg)';
COMMENT ON COLUMN company_logos.bytes IS 'Tamaño del archivo en bytes (auditoría de storage)';
COMMENT ON COLUMN company_logos.uploaded_at IS 'Fecha de la última subida/reemplazo';