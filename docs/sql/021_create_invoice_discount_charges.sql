-- ============================================================
-- 021_create_invoice_discount_charges.sql
-- ============================================================
-- Proyecto : ExpedíNap — Facturación Electrónica DGII
-- DT        : DT33 — Sección D: <DescuentosORecargos>
-- Propósito : Crear la tabla invoice_discount_charges para
--             almacenar los descuentos y recargos GLOBALES
--             por factura (hasta 20 por factura), según el
--             PDF DGII "Formato Comprobante Fiscal Electrónico V1.0".
-- Autor     : [tu nombre]
-- Fecha     : 2025-XX-XX
-- Depende   : 019_create_invoices.sql (o el que haya creado invoices)
--             Tabla invoices.id debe ser UUID.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS invoice_discount_charges (
    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id                  UUID            NOT NULL,
    numero_linea                SMALLINT        NOT NULL,
    tipo_ajuste                 CHAR(1)         NOT NULL,
    indicador_norma_1007        SMALLINT        NULL,
    descripcion                 VARCHAR(45)     NULL,
    tipo_valor                  CHAR(1)         NOT NULL,
    valor                       DECIMAL(5, 2)   NULL,
    monto                       DECIMAL(15, 2)  NOT NULL DEFAULT 0,
    monto_otra_moneda           DECIMAL(15, 2)  NULL,
    indicador_facturacion       SMALLINT        NOT NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- FK a invoices (CASCADE: si se borra la factura, se borran sus descuentos)
    CONSTRAINT fk_invoice_discount_charges_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES invoices (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Validaciones DGII
    CONSTRAINT chk_invoice_discount_charges_numero_linea
        CHECK (numero_linea BETWEEN 1 AND 20),

    CONSTRAINT chk_invoice_discount_charges_tipo_ajuste
        CHECK (tipo_ajuste IN ('D', 'R')),

    CONSTRAINT chk_invoice_discount_charges_indicador_norma_1007
        CHECK (indicador_norma_1007 IS NULL OR indicador_norma_1007 = 1),

    CONSTRAINT chk_invoice_discount_charges_tipo_valor
        CHECK (tipo_valor IN ('%', '$')),

    CONSTRAINT chk_invoice_discount_charges_valor
        CHECK (
            (tipo_valor = '%' AND valor IS NOT NULL AND valor > 0 AND valor <= 100)
            OR
            (tipo_valor = '$' AND valor IS NULL)
        ),

    CONSTRAINT chk_invoice_discount_charges_monto
        CHECK (monto >= 0),

    CONSTRAINT chk_invoice_discount_charges_indicador_facturacion
        CHECK (indicador_facturacion IN (1, 2, 3, 4))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoice_discount_charges_invoice_id
    ON invoice_discount_charges (invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_discount_charges_invoice_numero
    ON invoice_discount_charges (invoice_id, numero_linea);

-- Comentarios (para que se entienda en PG Admin)
COMMENT ON TABLE  invoice_discount_charges IS 'DT33 — Descuentos y recargos globales por factura (hasta 20)';
COMMENT ON COLUMN invoice_discount_charges.numero_linea             IS 'Secuencial 1-20 dentro de la factura';
COMMENT ON COLUMN invoice_discount_charges.tipo_ajuste              IS 'D = Descuento, R = Recargo';
COMMENT ON COLUMN invoice_discount_charges.indicador_norma_1007     IS '1 si aplica norma 10-07 (solo si es descuento)';
COMMENT ON COLUMN invoice_discount_charges.descripcion              IS 'Texto libre, máx 45 chars';
COMMENT ON COLUMN invoice_discount_charges.tipo_valor               IS '% = porcentaje, $ = monto fijo';
COMMENT ON COLUMN invoice_discount_charges.valor                    IS 'Porcentaje (solo si tipo_valor = %)';
COMMENT ON COLUMN invoice_discount_charges.monto                    IS 'Monto en DOP';
COMMENT ON COLUMN invoice_discount_charges.monto_otra_moneda        IS 'Monto en moneda extranjera (si aplica)';
COMMENT ON COLUMN invoice_discount_charges.indicador_facturacion    IS '1=ITBIS1, 2=ITBIS2, 3=ITBIS3, 4=Exento';

COMMIT;