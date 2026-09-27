-- ============================================================
-- Tabla: invoice_lines
-- Propósito: Detalle de cada factura (productos/servicios)
-- Depende de: invoices
-- Fase: 1
-- Fecha: 2026-09-22
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL,
    line_number INT NOT NULL,
    item_code VARCHAR(50),
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    itbis_rate DECIMAL(5,2) NOT NULL DEFAULT 18,
    itbis_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Constraints de validación
    CONSTRAINT chk_invoice_lines_line_number CHECK (line_number > 0),
    CONSTRAINT chk_invoice_lines_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_lines_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_invoice_lines_discount CHECK (discount >= 0),
    CONSTRAINT chk_invoice_lines_itbis_rate CHECK (itbis_rate >= 0 AND itbis_rate <= 100),
    CONSTRAINT chk_invoice_lines_itbis_amount CHECK (itbis_amount >= 0),
    CONSTRAINT chk_invoice_lines_total CHECK (total >= 0),

    -- Unique: no puede haber dos líneas con el mismo número en una factura
    CONSTRAINT uq_invoice_lines_invoice_line UNIQUE (invoice_id, line_number),

    -- Foreign Key con CASCADE (si se borra la factura, se borran sus líneas)
    CONSTRAINT fk_invoice_lines_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_code ON invoice_lines (item_code);

-- Comentarios
COMMENT ON TABLE invoice_lines IS 'Detalle de cada factura (productos y servicios)';
COMMENT ON COLUMN invoice_lines.invoice_id IS 'Factura a la que pertenece esta línea';
COMMENT ON COLUMN invoice_lines.line_number IS 'Número de línea dentro de la factura (1, 2, 3...)';
COMMENT ON COLUMN invoice_lines.item_code IS 'Código del producto/servicio (opcional)';
COMMENT ON COLUMN invoice_lines.description IS 'Descripción del producto/servicio';
COMMENT ON COLUMN invoice_lines.quantity IS 'Cantidad (soporta decimales para servicios fraccionados)';
COMMENT ON COLUMN invoice_lines.unit_price IS 'Precio unitario sin impuestos';
COMMENT ON COLUMN invoice_lines.discount IS 'Descuento aplicado a esta línea';
COMMENT ON COLUMN invoice_lines.itbis_rate IS 'Porcentaje de ITBIS (18% estándar, 16% reducido)';
COMMENT ON COLUMN invoice_lines.itbis_amount IS 'Monto de ITBIS calculado para esta línea';
COMMENT ON COLUMN invoice_lines.total IS 'Total de la línea (quantity * unit_price - discount + itbis_amount)';

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoice_lines'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'invoice_lines'::regclass
ORDER BY conname;