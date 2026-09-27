-- SELECT LOG HISTÓRICO DE TODA LA APP (últimos 100)
SELECT
    id,
    company_id,
    user_id,
    action,
    entity,
    entity_id,
    before,
    after,
    ip,
    user_agent,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

-- Ver todos los cambios de empresa
SELECT
    created_at,
    action,
    before,
    after
FROM audit_logs
WHERE entity = 'company'
ORDER BY created_at DESC
LIMIT 50;