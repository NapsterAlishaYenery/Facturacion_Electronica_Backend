-- Database: facturacion_electronica

-- DROP DATABASE IF EXISTS facturacion_electronica;

CREATE DATABASE facturacion_electronica
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Spanish_Dominican Republic.1252'
    LC_CTYPE = 'Spanish_Dominican Republic.1252'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

COMMENT ON DATABASE facturacion_electronica
    IS 'BD para sistema de facturación electrónica DGII';

	CREATE EXTENSION IF NOT EXISTS "pgcrypto";

	SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pgcrypto';