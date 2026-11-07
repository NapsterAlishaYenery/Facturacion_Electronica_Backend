BEGIN;

-- 1. Eliminar la constraint actual
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS chk_invoices_non_notas_no_reference;

-- 2. Crear la constraint nueva con la lógica DT35 correcta
ALTER TABLE invoices
ADD CONSTRAINT chk_invoices_non_notas_no_reference
CHECK (
    (
        -- Bloque 1: Notas 33/34 → pueden tener referencia
        type IN ('33', '34')
    )
    OR
    (
        -- Bloque 2: 31 con code 4 o 5 → puede tener referencia
        -- (4 = reemplazo contingencia, 5 = referencia FC 32)
        type = '31'
        AND modification_code IN (4, 5)
    )
    OR
    (
        -- Bloque 3: 32, 41, 43, 44, 45, 46, 47 con code 4 → puede tener referencia
        -- (4 = reemplazo contingencia, único código aplicable a estos tipos)
        type IN ('32', '41', '43', '44', '45', '46', '47')
        AND modification_code = 4
    )
    OR
    (
        -- Bloque 4: resto de los casos → NO debe haber referencia
        -- (todos los campos de referencia deben ser NULL)
        modified_ncf IS NULL
        AND modified_ncf_date IS NULL
        AND modified_ncf_issuer_rnc IS NULL
        AND modification_code IS NULL
        AND modification_reason IS NULL
    )
);

COMMIT;