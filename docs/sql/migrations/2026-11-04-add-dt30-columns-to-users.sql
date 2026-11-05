-- ============================================================
-- DT30 — Migración: campos adicionales de User (vendedor)
-- Tabla: users
-- Fecha: 2026-11-04
-- Propósito:
--   - Guardar el CodigoVendedor por defecto de cada usuario
--     (company_admin / operator) para no teclearlo en cada factura.
--   - El usuario puede sobreescribirlo al crear una factura.
-- Afecta: users
-- ============================================================

BEGIN;

-- 1. codigoVendedor por defecto del usuario
--    STRING(60) igual que Invoice.codigoVendedor
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS codigo_vendedor VARCHAR(60) NULL;

COMMENT ON COLUMN users.codigo_vendedor
    IS 'DT30: CodigoVendedor por defecto del usuario. Se usa al crear facturas si no se especifica uno en el body. Solo aplica a roles company_admin y operator.';


-- 2. Índice opcional (por si buscas facturas por vendedor)
--    No es crítico. Lo dejo comentado para no inflar la tabla.
-- CREATE INDEX IF NOT EXISTS idx_users_codigo_vendedor
--     ON users (codigo_vendedor);


COMMIT;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
--   ALTER TABLE users DROP COLUMN IF EXISTS codigo_vendedor;
-- COMMIT;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT id, email, role, codigo_vendedor
-- FROM users
-- ORDER BY created_at DESC
-- LIMIT 20;


-- ============================================================
-- POBLAR con valores de prueba (ejecuta después de la migración)
-- ============================================================
-- 1. Ver usuarios actuales
SELECT id, email, role, codigo_vendedor
FROM users
ORDER BY created_at DESC;

-- 2. Setear un código por defecto a todos los company_admin y operator
UPDATE users
SET codigo_vendedor = 'V001'
WHERE role IN ('company_admin', 'operator')
  AND codigo_vendedor IS NULL;

-- 3. (Opcional) Setear valores distintos por email
-- UPDATE users SET codigo_vendedor = 'V001' WHERE email = 'admin@empresa.com';
-- UPDATE users SET codigo_vendedor = 'V002' WHERE email = 'operador1@empresa.com';
-- UPDATE users SET codigo_vendedor = 'V003' WHERE email = 'operador2@empresa.com';

-- 4. Verificación
SELECT id, email, role, codigo_vendedor
FROM users
ORDER BY created_at DESC;