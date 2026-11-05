ALTER TABLE companies
    ADD COLUMN province_dgii_code VARCHAR(6),
    ADD COLUMN municipality_dgii_code VARCHAR(6);

	UPDATE companies
SET province_dgii_code = '110000',
    municipality_dgii_code = '110100'
WHERE province_dgii_code IS NULL;

SELECT COUNT(*) FROM companies WHERE province_dgii_code IS NULL;

BEGIN;

-- 3.1 Forzar NOT NULL
ALTER TABLE companies
    ALTER COLUMN province_dgii_code SET NOT NULL,
    ALTER COLUMN municipality_dgii_code SET NOT NULL;

-- 3.2 Agregar FKs
ALTER TABLE companies
    ADD CONSTRAINT fk_companies_province
        FOREIGN KEY (province_dgii_code)
        REFERENCES provinces (dgii_code)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    ADD CONSTRAINT fk_companies_municipality
        FOREIGN KEY (municipality_dgii_code)
        REFERENCES municipalities (dgii_code)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

-- 3.3 Índices
CREATE INDEX idx_companies_province ON companies (province_dgii_code);
CREATE INDEX idx_companies_municipality ON companies (municipality_dgii_code);

-- 3.4 Comentarios
COMMENT ON COLUMN companies.province_dgii_code IS 'FK a provinces.dgii_code — Emisor.Provincia (Tabla III DGII)';
COMMENT ON COLUMN companies.municipality_dgii_code IS 'FK a municipalities.dgii_code — Emisor.Municipio (Tabla III DGII)';

COMMIT;