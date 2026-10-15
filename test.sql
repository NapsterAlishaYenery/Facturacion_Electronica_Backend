SELECT column_name FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

select * from sequences

BEGIN;

DELETE FROM invoice_lines WHERE invoice_id IN (
    '900ba49b-06a0-4c14-99ff-f719ba8dbb35',
    '9126e22c-c21d-48b3-9c28-3c6021dfc928'
);

DELETE FROM invoices WHERE id IN (
    '900ba49b-06a0-4c14-99ff-f719ba8dbb35',
    '9126e22c-c21d-48b3-9c28-3c6021dfc928'
);

COMMIT;

SELECT id, ncf, type, status, total, LENGTH(xml_content) as xml_len
FROM invoices
WHERE company_id = 'fb187614-0412-4d82-ae96-283a0394ae84'
ORDER BY created_at DESC LIMIT 20;