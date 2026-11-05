
BEGIN;

CREATE OR REPLACE FUNCTION check_company_province_municipality()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM municipalities
        WHERE dgii_code = NEW.municipality_dgii_code
          AND province_dgii_code = NEW.province_dgii_code
    ) THEN
        RAISE EXCEPTION 'Municipality % does not belong to province %',
            NEW.municipality_dgii_code, NEW.province_dgii_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_province_municipality
BEFORE INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION check_company_province_municipality();

COMMIT;