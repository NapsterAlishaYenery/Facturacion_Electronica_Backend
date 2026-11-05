-- ============================================================
-- DT32 — Migración: tabla invoice_subtotals
-- Fecha: 2026-11-05
-- Propósito: Alinear el bloque <Subtotales> con el PDF DGII v1.0
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS invoice_subtotals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    invoice_id UUID NOT NULL REFERENCES invoices (id) ON DELETE CASCADE ON UPDATE CASCADE,

    numero_subtotal SMALLINT NOT NULL,
    descripcion VARCHAR(40) NULL,
    orden SMALLINT NULL,

    monto_gravado_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    monto_gravado_i1 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    monto_gravado_i2 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    monto_gravado_i3 DECIMAL(15, 2) NOT NULL DEFAULT 0,

    sub_total_itbis DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sub_total_itbis1 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sub_total_itbis2 DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sub_total_itbis3 DECIMAL(15, 2) NOT NULL DEFAULT 0,

    sub_total_impuesto_adicional DECIMAL(15, 2) NOT NULL DEFAULT 0,
    sub_total_exento DECIMAL(15, 2) NOT NULL DEFAULT 0,
    monto_sub_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    lineas SMALLINT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT chk_invoice_subtotals_numero
        CHECK (numero_subtotal >= 1 AND numero_subtotal <= 20)
);

CREATE INDEX IF NOT EXISTS idx_invoice_subtotals_invoice_id
    ON invoice_subtotals (invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_subtotals_invoice_numero
    ON invoice_subtotals (invoice_id, numero_subtotal);

COMMENT ON TABLE invoice_subtotals IS 'DT32: <Subtotales> del e-CF — agrupaciones opcionales de líneas';
COMMENT ON COLUMN invoice_subtotals.numero_subtotal IS 'DT32: <NumeroSubTotal> — 1-20';
COMMENT ON COLUMN invoice_subtotals.descripcion IS 'DT32: <DescripcionSubtotal> — máx 40 chars';
COMMENT ON COLUMN invoice_subtotals.orden IS 'DT32: <Orden> — orden de impresión';
COMMENT ON COLUMN invoice_subtotals.monto_gravado_total IS 'DT32: <SubTotalMontoGravadoTotal> = I1 + I2 + I3';
COMMENT ON COLUMN invoice_subtotals.monto_gravado_i1 IS 'DT32: <SubTotalMontoGravadoI1> — ITBIS 18%';
COMMENT ON COLUMN invoice_subtotals.monto_gravado_i2 IS 'DT32: <SubTotalMontoGravadoI2> — ITBIS 16%';
COMMENT ON COLUMN invoice_subtotals.monto_gravado_i3 IS 'DT32: <SubTotalMontoGravadoI3> — ITBIS 0%';
COMMENT ON COLUMN invoice_subtotals.sub_total_itbis IS 'DT32: <SubTotaITBIS> = ITBIS1 + ITBIS2 + ITBIS3';
COMMENT ON COLUMN invoice_subtotals.sub_total_itbis1 IS 'DT32: <SubTotaITBIS1>';
COMMENT ON COLUMN invoice_subtotals.sub_total_itbis2 IS 'DT32: <SubTotaITBIS2>';
COMMENT ON COLUMN invoice_subtotals.sub_total_itbis3 IS 'DT32: <SubTotaITBIS3>';
COMMENT ON COLUMN invoice_subtotals.sub_total_impuesto_adicional IS 'DT32: <SubTotalImpuestoAdicional>';
COMMENT ON COLUMN invoice_subtotals.sub_total_exento IS 'DT32: <SubTotalExento>';
COMMENT ON COLUMN invoice_subtotals.monto_sub_total IS 'DT32: <MontoSubTotal> = gravadoTotal + ITBIS + impAdic + exento';
COMMENT ON COLUMN invoice_subtotals.lineas IS 'DT32: <Lineas> — cantidad de líneas que abarca';

COMMIT;