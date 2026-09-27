-- ============================================================
-- Tabla: password_resets
-- Propósito: Códigos de recuperación de contraseña
-- Depende de: users
-- Fase: 3
-- Fecha: 2026-09-24
-- ============================================================

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Foreign Key con CASCADE
    CONSTRAINT fk_password_resets_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets (user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_code ON password_resets (code);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets (expires_at);

-- Comentarios
COMMENT ON TABLE password_resets IS 'Códigos de recuperación de contraseña (válidos por tiempo limitado)';
COMMENT ON COLUMN password_resets.code IS 'Código de 6 dígitos enviado al usuario';
COMMENT ON COLUMN password_resets.expires_at IS 'Fecha de expiración del código (15 minutos)';
COMMENT ON COLUMN password_resets.used_at IS 'Fecha en que se usó el código (NULL si no se ha usado)';