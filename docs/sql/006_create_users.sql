-- ============================================================
-- Tabla: users
-- Propósito: Usuarios del sistema (admin, dueños de empresas, operadores)
-- Depende de: companies
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    middle_name VARCHAR(80),
    last_name VARCHAR(80) NOT NULL,
    second_last_name VARCHAR(80),
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_users_role CHECK (
        role IN ('admin', 'company_admin', 'operator')
    ),
    CONSTRAINT chk_users_email_format CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT chk_users_admin_company CHECK (
        (role = 'admin' AND company_id IS NULL) OR
        (role IN ('company_admin', 'operator') AND company_id IS NOT NULL)
    ),

    -- Foreign Key
    CONSTRAINT fk_users_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users (last_name);

-- Comentarios
COMMENT ON TABLE users IS 'Usuarios del sistema: admin, dueños de empresa y operadores';
COMMENT ON COLUMN users.company_id IS 'Empresa a la que pertenece (NULL = admin global del sistema)';
COMMENT ON COLUMN users.email IS 'Email único del usuario (usado para login)';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt de la contraseña (nunca texto plano)';
COMMENT ON COLUMN users.first_name IS 'Primer nombre del usuario';
COMMENT ON COLUMN users.middle_name IS 'Segundo nombre (opcional)';
COMMENT ON COLUMN users.last_name IS 'Primer apellido del usuario';
COMMENT ON COLUMN users.second_last_name IS 'Segundo apellido (opcional)';
COMMENT ON COLUMN users.role IS 'Rol: admin (sistema), company_admin (dueño), operator (empleado)';
COMMENT ON COLUMN users.is_active IS 'Si el usuario puede iniciar sesión';
COMMENT ON COLUMN users.last_login_at IS 'Fecha y hora del último inicio de sesión';


SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;


SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND contype = 'c'
ORDER BY conname;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND contype = 'f';


-- Datos de prueba (admin del sistema)
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
    'admin@expedinap.com',
    '$2b$12$hash_de_prueba_no_real_para_rellenar',
    'Administrador',
    'ExpediNap',
    'admin'
);


INSERT INTO users (company_id, email, password_hash, full_name, role)
VALUES (
    (SELECT id FROM companies LIMIT 1),
    'admin@test.com',
    'hash_falso',
    'Admin Test',
    'admin'
);

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'operador@test.com',
    'hash_falso',
    'Operador Test',
    'operator'
);


INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'no-es-un-email',
    'hash_falso',
    'Test',
    'admin'
);

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'admin@expedinap.com',
    '$2b$12$hash_de_prueba_no_real',
    'Administrador ExpediNap',
    'admin'
);

SELECT id, email, full_name, role, company_id, is_active
FROM users
WHERE role = 'admin';









