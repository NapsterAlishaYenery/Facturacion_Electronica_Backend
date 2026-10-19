-- ============================================================
-- Tabla: products
-- Propósito: Catálogo de productos/servicios de una empresa
--            para el POS interno (Fase 17).
-- Fecha: 2026-10-19
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL
        REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    tax_type VARCHAR(20) NOT NULL
        CHECK (tax_type IN ('ITBIS_18', 'ITBIS_16', 'EXENTO', 'ITBIS_3_46')),
    item_code VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_company_id ON products (company_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_company_active ON products (company_id, is_active);

-- item_code único por empresa (solo cuando NO es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_company_item_code
    ON products (company_id, item_code)
    WHERE item_code IS NOT NULL;

COMMENT ON TABLE products IS 'Catálogo de productos/servicios por empresa para el POS interno';
COMMENT ON COLUMN products.tax_type IS 'ITBIS_18 | ITBIS_16 | EXENTO | ITBIS_3_46. ITBIS_3_46 solo aplica a e-CF tipo 46.';
COMMENT ON COLUMN products.item_code IS 'Código interno opcional (SKU, referencia, etc.). Único por empresa.';