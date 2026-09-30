ALTER TABLE invoice_lines
    ADD COLUMN IF NOT EXISTS retencion_indicador SMALLINT,
    ADD COLUMN IF NOT EXISTS monto_itbis_retenido DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS monto_isr_retenido DECIMAL(15,2);

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_retencion_indicador
        CHECK (retencion_indicador IS NULL OR retencion_indicador IN (1, 2));

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_monto_itbis_retenido
        CHECK (monto_itbis_retenido IS NULL OR monto_itbis_retenido >= 0);

ALTER TABLE invoice_lines
    ADD CONSTRAINT chk_invoice_lines_monto_isr_retenido
        CHECK (monto_isr_retenido IS NULL OR monto_isr_retenido >= 0);

COMMENT ON COLUMN invoice_lines.retencion_indicador IS
    'Tipo de retención: 1=Retención, 2=Percepción (solo tipos 41 y 47)';
COMMENT ON COLUMN invoice_lines.monto_itbis_retenido IS
    'ITBIS retenido por línea (solo tipo 41)';
COMMENT ON COLUMN invoice_lines.monto_isr_retenido IS
    'ISR retenido por línea (solo tipos 41 y 47)';