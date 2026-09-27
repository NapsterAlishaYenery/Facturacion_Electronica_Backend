-- ============================================================
-- Crear administrador inicial del sistema
-- ============================================================

INSERT INTO users (
    email,
    password_hash,
    first_name,
    middle_name,
    last_name,
    second_last_name,
    role,
    is_active,
    last_login_at
)
VALUES (
    'youemail@gmial.com',
    'hash_password',
    'yourname',
    'middlename',
    'lastname',
    'secondlastname',
    'admin',
    true,
    NULL
);

SELECT
    id,
    company_id,
    email,
    first_name,
    middle_name,
    last_name,
    second_last_name,
    role,
    is_active,
    last_login_at,
    created_at,
    updated_at
FROM users
WHERE email = 'youemail@gmial.com';