-- ============================================================
-- Migración: campos de Notas de Débito/Crédito (33/34) en invoices
-- Fecha: 2026-09-28
-- Depende de: invoices (creada en Fase 1)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columnas (todas nullable por defecto)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS modified_ncf VARCHAR(20),
    ADD COLUMN IF NOT EXISTS modified_ncf_issuer_rnc VARCHAR(15),
    ADD COLUMN IF NOT EXISTS modified_ncf_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS modification_code SMALLINT,
    ADD COLUMN IF NOT EXISTS modification_reason VARCHAR(90),
    ADD COLUMN IF NOT EXISTS indicador_nota_credito SMALLINT;

-- ------------------------------------------------------------
-- 2. Constraints de rango
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_modification_code
        CHECK (modification_code IS NULL OR (modification_code BETWEEN 1 AND 5));

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_nota_credito
        CHECK (indicador_nota_credito IS NULL OR (indicador_nota_credito IN (0, 1)));

-- ------------------------------------------------------------
-- 3. Constraints lógicas de negocio
-- ------------------------------------------------------------

-- Si el tipo es 33 o 34, los campos de referencia son OBLIGATORIOS
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_notas_require_reference
        CHECK (
            type NOT IN ('33', '34')
            OR (
                modified_ncf IS NOT NULL
                AND modified_ncf_date IS NOT NULL
                AND modification_code IS NOT NULL
            )
        );

-- Si el tipo NO es 33 ni 34, los campos de referencia deben ser NULL
-- (defensa contra data sucia: un 32 no puede tener modified_ncf)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_non_notas_no_reference
        CHECK (
            type IN ('33', '34')
            OR (
                modified_ncf IS NULL
                AND modified_ncf_date IS NULL
                AND modification_code IS NULL
                AND modification_reason IS NULL
                AND modified_ncf_issuer_rnc IS NULL
            )
        );

-- El indicadorNotaCredito SOLO puede estar en el tipo 34
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_solo_34
        CHECK (indicador_nota_credito IS NULL OR type = '34');

-- ------------------------------------------------------------
-- 4. Índice para búsquedas
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_modified_ncf
    ON invoices (modified_ncf);

CREATE INDEX IF NOT EXISTS idx_invoices_company_type_modified
    ON invoices (company_id, type, modified_ncf);

-- ------------------------------------------------------------
-- 5. Comentarios
-- ------------------------------------------------------------
COMMENT ON COLUMN invoices.modified_ncf IS
    'NCF de la factura original que esta nota modifica (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modified_ncf_issuer_rnc IS
    'RNC del emisor de la factura original (opcional, AlfNum15)';

COMMENT ON COLUMN invoices.modified_ncf_date IS
    'Fecha de emisión de la factura original (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_code IS
    'Código de modificación: 1=anula, 2=corrige texto, 3=corrige montos, 4=reemplazo contingencia, 5=referencia FC (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_reason IS
    'Razón de la modificación (opcional, AlfNum90)';

COMMENT ON COLUMN invoices.indicador_nota_credito IS
    'Solo 34: 0=fecha original <=30 días, 1=fecha original >30 días';



-- ============================================================
-- Migración: campos de Notas de Débito/Crédito (33/34) en invoices
-- Fecha: 2026-09-28
-- Depende de: invoices (creada en Fase 1)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columnas (todas nullable por defecto)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS modified_ncf VARCHAR(20),
    ADD COLUMN IF NOT EXISTS modified_ncf_issuer_rnc VARCHAR(15),
    ADD COLUMN IF NOT EXISTS modified_ncf_date TIMESTAMP,
    ADD COLUMN IF NOT EXISTS modification_code SMALLINT,
    ADD COLUMN IF NOT EXISTS modification_reason VARCHAR(90),
    ADD COLUMN IF NOT EXISTS indicador_nota_credito SMALLINT;

-- ------------------------------------------------------------
-- 2. Constraints de rango
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_modification_code
        CHECK (modification_code IS NULL OR (modification_code BETWEEN 1 AND 5));

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_nota_credito
        CHECK (indicador_nota_credito IS NULL OR (indicador_nota_credito IN (0, 1)));

-- ------------------------------------------------------------
-- 3. Constraints lógicas de negocio
-- ------------------------------------------------------------

-- Si el tipo es 33 o 34, los campos de referencia son OBLIGATORIOS
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_notas_require_reference
        CHECK (
            type NOT IN ('33', '34')
            OR (
                modified_ncf IS NOT NULL
                AND modified_ncf_date IS NOT NULL
                AND modification_code IS NOT NULL
            )
        );

-- Si el tipo NO es 33 ni 34, los campos de referencia deben ser NULL
-- (defensa contra data sucia: un 32 no puede tener modified_ncf)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_non_notas_no_reference
        CHECK (
            type IN ('33', '34')
            OR (
                modified_ncf IS NULL
                AND modified_ncf_date IS NULL
                AND modification_code IS NULL
                AND modification_reason IS NULL
                AND modified_ncf_issuer_rnc IS NULL
            )
        );

-- El indicadorNotaCredito SOLO puede estar en el tipo 34
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_solo_34
        CHECK (indicador_nota_credito IS NULL OR type = '34');

-- ------------------------------------------------------------
-- 4. Índice para búsquedas
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_modified_ncf
    ON invoices (modified_ncf);

CREATE INDEX IF NOT EXISTS idx_invoices_company_type_modified
    ON invoices (company_id, type, modified_ncf);

-- ------------------------------------------------------------
-- 5. Comentarios
-- ------------------------------------------------------------
COMMENT ON COLUMN invoices.modified_ncf IS
    'NCF de la factura original que esta nota modifica (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modified_ncf_issuer_rnc IS
    'RNC del emisor de la factura original (opcional, AlfNum15)';

COMMENT ON COLUMN invoices.modified_ncf_date IS
    'Fecha de emisión de la factura original (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_code IS
    'Código de modificación: 1=anula, 2=corrige texto, 3=corrige montos, 4=reemplazo contingencia, 5=referencia FC (obligatorio en 33/34)';

COMMENT ON COLUMN invoices.modification_reason IS
    'Razón de la modificación (opcional, AlfNum90)';

COMMENT ON COLUMN invoices.indicador_nota_credito IS
    'Solo 34: 0=fecha original <=30 días, 1=fecha original >30 días';

    -- Si el tipo NO es 33 ni 34, los campos de referencia deben ser NULL
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_non_notas_no_reference ...


    -- Ver las columnas nuevas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN (
    'modified_ncf', 'modified_ncf_issuer_rnc', 'modified_ncf_date',
    'modification_code', 'modification_reason', 'indicador_nota_credito'
  )
ORDER BY column_name;

-- Ver las constraints nuevas
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'invoices'::regclass
  AND conname LIKE 'chk_invoices_%'
ORDER BY conname;



-- Fecha: 2026-09-29
-- Depende de: invoices (Fase 1) + migración previa de 33/34
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas para tipos 43, 44, 46, 47 (exentos / extranjero)
-- ------------------------------------------------------------

-- Comprador extranjero (46, 47)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS receiver_identificador_extranjero VARCHAR(20),
    ADD COLUMN IF NOT EXISTS receiver_pais VARCHAR(60);

-- Exento: 43, 44, 46, 47 no desglosan ITBIS pero manejan monto exento
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS exempt_amount DECIMAL(15,2);

-- ITBIS3 (46 usa ITBIS3 exclusivamente)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS itbis3_base DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS itbis3_amount DECIMAL(15,2);

-- Retención a nivel de encabezado (41, 47)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_retenido DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS total_isr_retencion DECIMAL(15,2);

-- ------------------------------------------------------------
-- 2. Bloque <Transporte> (31, 32, 33, 34, 44, 45, 46, 47)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS transporte_via VARCHAR(2),                  -- 01=Terrestre, 02=Marítimo, 03=Aérea
    ADD COLUMN IF NOT EXISTS transporte_pais_origen VARCHAR(60),
    ADD COLUMN IF NOT EXISTS transporte_direccion_destino VARCHAR(100),
    ADD COLUMN IF NOT EXISTS transporte_pais_destino VARCHAR(60),
    ADD COLUMN IF NOT EXISTS transporte_rnc_compania VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_nombre_compania VARCHAR(150),
    ADD COLUMN IF NOT EXISTS transporte_numero_viaje VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_conductor VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_documento VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_ficha VARCHAR(10),
    ADD COLUMN IF NOT EXISTS transporte_placa VARCHAR(7),
    ADD COLUMN IF NOT EXISTS transporte_ruta VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_zona VARCHAR(20),
    ADD COLUMN IF NOT EXISTS transporte_numero_albaran VARCHAR(20);

-- ------------------------------------------------------------
-- 3. Bloque <InformacionesAdicionales> extendido (solo 46)
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_fecha_embarque TIMESTAMP,
    ADD COLUMN IF NOT EXISTS info_numero_embarque VARCHAR(25),
    ADD COLUMN IF NOT EXISTS info_numero_contenedor VARCHAR(100),
    ADD COLUMN IF NOT EXISTS info_nombre_puerto_embarque VARCHAR(40),
    ADD COLUMN IF NOT EXISTS info_condiciones_entrega VARCHAR(3),        -- FOB, CIF, etc.
    ADD COLUMN IF NOT EXISTS info_total_fob DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS info_seguro DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS info_flete DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS info_otros_gastos DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS info_total_cif DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS info_regimen_aduanero VARCHAR(35),
    ADD COLUMN IF NOT EXISTS info_nombre_puerto_salida VARCHAR(40),
    ADD COLUMN IF NOT EXISTS info_nombre_puerto_desembarque VARCHAR(40);

-- ------------------------------------------------------------
-- 4. Constraints de rango
-- ------------------------------------------------------------
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_transporte_via
        CHECK (transporte_via IS NULL OR transporte_via IN ('01', '02', '03'));

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_exempt_amount
        CHECK (exempt_amount IS NULL OR exempt_amount >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_itbis3_amount
        CHECK (itbis3_amount IS NULL OR itbis3_amount >= 0);

-- ------------------------------------------------------------
-- 5. Constraints lógicas por tipo
-- ------------------------------------------------------------

-- 43 NO lleva Comprador (ni RNC ni nombre)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_43_no_comprador
        CHECK (
            type <> '43'
            OR (receiver_rnc IS NULL AND receiver_name IS NULL)
        );

-- 46 y 47 requieren identificador extranjero si no hay RNC
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_46_47_identificador
        CHECK (
            type NOT IN ('46', '47')
            OR (receiver_rnc IS NOT NULL OR receiver_identificador_extranjero IS NOT NULL)
        );

-- 46: ITBIS3 obligatorio (exportación tasa 0)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_46_itbis3
        CHECK (
            type <> '46'
            OR (itbis3_base IS NOT NULL AND itbis3_amount IS NOT NULL)
        );

-- 41 y 47: retención obligatoria a nivel encabezado (ya se controla por línea en XML,
-- pero guardamos los totales para reportes)
ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_41_47_retencion
        CHECK (
            type NOT IN ('41', '47')
            OR (total_itbis_retenido IS NOT NULL OR total_isr_retencion IS NOT NULL)
        );

-- ------------------------------------------------------------
-- 6. Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_type_status
    ON invoices (type, status);

CREATE INDEX IF NOT EXISTS idx_invoices_receiver_extranjero
    ON invoices (receiver_identificador_extranjero)
    WHERE receiver_identificador_extranjero IS NOT NULL;

-- ------------------------------------------------------------
-- 7. Comentarios
-- ------------------------------------------------------------
COMMENT ON COLUMN invoices.receiver_identificador_extranjero IS
    'Identificación de comprador extranjero sin RNC dominicano (46, 47)';
COMMENT ON COLUMN invoices.exempt_amount IS
    'Monto exento total (43, 44, 47). Reemplaza al desglose ITBIS cuando el tipo no lo usa.';
COMMENT ON COLUMN invoices.itbis3_base IS
    'Base gravada ITBIS3 (0%) — usado en 46 (exportación)';
COMMENT ON COLUMN invoices.total_itbis_retenido IS
    'Total ITBIS retenido a nivel encabezado (41, 47)';
COMMENT ON COLUMN invoices.total_isr_retencion IS
    'Total ISR retenido a nivel encabezado (41, 47)';

    ALTER TABLE invoices
    ADD COLUMN send_attempts INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices.send_attempts IS 'Número de intentos de envío a DGII (máx 5 antes de rejected)';