-- ============================================================
-- Tabla: companies
-- Propósito: Empresas/clientes que emiten facturas electrónicas
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rnc VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    trade_name VARCHAR(200),
    email VARCHAR(150),
    phone VARCHAR(30),
    address VARCHAR(300),
    economic_activity VARCHAR(200),
    certificate_path VARCHAR(300),
    certificate_password VARCHAR(200),
    certificate_expires_at TIMESTAMP,
    dgii_environment VARCHAR(20) NOT NULL DEFAULT 'testecf'
        CHECK (dgii_environment IN ('testecf', 'production')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_companies_rnc ON companies (rnc);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies (is_active);

-- Comentarios (documentación viva de la BD)
COMMENT ON TABLE companies IS 'Empresas/clientes que emiten facturas electrónicas';
COMMENT ON COLUMN companies.rnc IS 'RNC de la empresa emisora';
COMMENT ON COLUMN companies.certificate_path IS 'Ruta al archivo .p12 del certificado digital';
COMMENT ON COLUMN companies.certificate_password IS 'Contraseña del certificado (encriptada con AES-256)';
COMMENT ON COLUMN companies.dgii_environment IS 'Ambiente DGII: testecf (pruebas) o production';


-- ============================================================
-- Refactor: campos de certificado en companies
-- Propósito: preparar la tabla para el cifrado AES-256-GCM
-- Fecha: 2026-09-25
-- ============================================================

-- 1. Renombrar el campo actual
ALTER TABLE companies
    RENAME COLUMN certificate_password TO certificate_password_encrypted;

-- 2. Agregar nuevos campos de cifrado
ALTER TABLE companies
    ADD COLUMN certificate_iv VARCHAR(50),
    ADD COLUMN certificate_auth_tag VARCHAR(50),
    ADD COLUMN certificate_uploaded_at TIMESTAMP;

-- 3. Actualizar comentarios
COMMENT ON COLUMN companies.certificate_path IS 'Ruta al archivo .p12 del certificado (en disco del VPS, cifrado)';
COMMENT ON COLUMN companies.certificate_password_encrypted IS 'Contraseña del certificado cifrada con AES-256-GCM (formato: iv:authTag:encrypted)';
COMMENT ON COLUMN companies.certificate_iv IS 'IV del cifrado del .p12 con AES-256-GCM';
COMMENT ON COLUMN companies.certificate_auth_tag IS 'Auth tag del cifrado del .p12 con AES-256-GCM';
COMMENT ON COLUMN companies.certificate_uploaded_at IS 'Fecha en que se subió el certificado (NULL si no se ha subido)';