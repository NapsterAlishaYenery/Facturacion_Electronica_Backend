-- ============================================================
-- DT30 — Migración: columnas nuevas en invoices
-- Tabla: invoices
-- Fecha: 2026-11-04
-- Propósito: Alinear el <Encabezado> del XML con el PDF DGII v1.0
--            (DT30 — Encabezado completo del e-CF)
--
-- Bloques:
--   A. <IdDoc>            (14 columnas)
--   B. <Emisor>           (6 columnas — las que dependen de Invoice)
--   C. <Comprador>        (14 columnas)
--   D. <InformacionesAdicionales> (9 columnas — las nuevas del DT30)
--   E. <Totales>          (10 columnas)
--   F. <OtraMoneda>       (15 columnas)
--
-- TODAS son nullable. Las columnas existentes (ej: transporte_*,
-- info_fecha_embarque, etc.) NO se tocan.
-- Rollback: ver al final del archivo
-- ============================================================

BEGIN;


-- ============================================================
-- BLOQUE A — <IdDoc>
-- ============================================================

-- 6. <IndicadorEnvioDiferido>  (0/1)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS indicador_envio_diferido SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_envio_diferido
    CHECK (indicador_envio_diferido IS NULL OR indicador_envio_diferido IN (0, 1));

COMMENT ON COLUMN invoices.indicador_envio_diferido
    IS 'DT30: <IndicadorEnvioDiferido> — 0/1. Null = no se emite.';

-- 7. <IndicadorMontoGravado>  (0/1)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS indicador_monto_gravado SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_monto_gravado
    CHECK (indicador_monto_gravado IS NULL OR indicador_monto_gravado IN (0, 1));

COMMENT ON COLUMN invoices.indicador_monto_gravado
    IS 'DT30: <IndicadorMontoGravado> — 0/1. Si =1, la base debe dividirse por (1+tasa/100).';

-- 8. <IndicadorServicioTodoIncluido>  (0/1)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS indicador_servicio_todo_incluido SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_indicador_servicio_todo_incluido
    CHECK (indicador_servicio_todo_incluido IS NULL OR indicador_servicio_todo_incluido IN (0, 1));

COMMENT ON COLUMN invoices.indicador_servicio_todo_incluido
    IS 'DT30: <IndicadorServicioTodoIncluido> — 0/1.';

-- 9. <TipoIngresos>  ('01'..'06')
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tipo_ingresos VARCHAR(2) NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_tipo_ingresos
    CHECK (tipo_ingresos IS NULL OR tipo_ingresos IN ('01','02','03','04','05','06'));

COMMENT ON COLUMN invoices.tipo_ingresos
    IS 'DT30: <TipoIngresos> — 01=Operaciones, 02=Financieros, 03=Extraordinarios, 04=Alquileres, 05=Regalías, 06=Demás. Default en app: 01.';

-- 10. <TipoPago>  (1,2,3)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tipo_pago SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_tipo_pago
    CHECK (tipo_pago IS NULL OR tipo_pago IN (1, 2, 3));

COMMENT ON COLUMN invoices.tipo_pago
    IS 'DT30: <TipoPago> — 1=Contado, 2=Crédito, 3=Gratuito. Default en app: 1.';

-- 11. <FechaLimitePago>  (obligatorio si TipoPago=2)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fecha_limite_pago DATE NULL;

COMMENT ON COLUMN invoices.fecha_limite_pago
    IS 'DT30: <FechaLimitePago> — obligatorio si tipo_pago=2 (crédito).';

-- 12. <TerminoPago>  (STRING(15))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS termino_pago VARCHAR(15) NULL;

COMMENT ON COLUMN invoices.termino_pago
    IS 'DT30: <TerminoPago> — texto libre del plazo (ej: "30 días"). Prohibido en tipo 34.';

-- 12-13. <TablaFormasPago>  (array JSON hasta 7 objetos)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS formas_pago JSONB NULL;

COMMENT ON COLUMN invoices.formas_pago
    IS 'DT30: <TablaFormasPago> — array JSON [{formaPago:1-8, montoPago:number}] máx 7. Prohibido en tipo 34.';

-- 14. <TipoCuentaPago>  ('CT','AH','OT')
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tipo_cuenta_pago VARCHAR(2) NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_tipo_cuenta_pago
    CHECK (tipo_cuenta_pago IS NULL OR tipo_cuenta_pago IN ('CT','AH','OT'));

COMMENT ON COLUMN invoices.tipo_cuenta_pago
    IS 'DT30: <TipoCuentaPago> — CT=Corriente, AH=Ahorro, OT=Otra. Prohibido en tipo 34.';

-- 15. <NumeroCuentaPago>  (STRING(28))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS numero_cuenta_pago VARCHAR(28) NULL;

COMMENT ON COLUMN invoices.numero_cuenta_pago
    IS 'DT30: <NumeroCuentaPago> — solo si hay pago por transferencia/cheque.';

-- 16. <BancoPago>  (STRING(75))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS banco_pago VARCHAR(75) NULL;

COMMENT ON COLUMN invoices.banco_pago
    IS 'DT30: <BancoPago> — nombre del banco del pago.';

-- 17. <FechaDesde>  (DATE)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fecha_desde DATE NULL;

COMMENT ON COLUMN invoices.fecha_desde
    IS 'DT30: <FechaDesde> — inicio del período facturado. Debe ser <= fecha_hasta.';

-- 18. <FechaHasta>  (DATE)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fecha_hasta DATE NULL;

COMMENT ON COLUMN invoices.fecha_hasta
    IS 'DT30: <FechaHasta> — fin del período facturado. Debe ser >= fecha_desde.';

-- 19. <TotalPaginas>  (INTEGER, default 1)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_paginas INTEGER NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_total_paginas
    CHECK (total_paginas IS NULL OR total_paginas >= 1);

COMMENT ON COLUMN invoices.total_paginas
    IS 'DT30: <TotalPaginas> — solo se emite si > 1. Default en app: 1.';


-- ============================================================
-- BLOQUE B — <Emisor> (los que viven en Invoice, no en Company)
-- ============================================================

-- 31. <CodigoVendedor>  (STRING(60)) — prohibido en 41, 43, 47
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS codigo_vendedor VARCHAR(60) NULL;

COMMENT ON COLUMN invoices.codigo_vendedor
    IS 'DT30: <CodigoVendedor> — prohibido en tipos 41, 43, 47.';

-- 32. <NumeroFacturaInterna>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS numero_factura_interna VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.numero_factura_interna
    IS 'DT30: <NumeroFacturaInterna> — número interno del emisor.';

-- 33. <NumeroPedidoInterno>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS numero_pedido_interno VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.numero_pedido_interno
    IS 'DT30: <NumeroPedidoInterno> — número de pedido interno.';

-- 34. <ZonaVenta>  (STRING(20)) — prohibido en 41, 43, 47
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS zona_venta VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.zona_venta
    IS 'DT30: <ZonaVenta> — prohibido en tipos 41, 43, 47.';

-- 35. <RutaVenta>  (STRING(20)) — prohibido en 41, 43, 47
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS ruta_venta VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.ruta_venta
    IS 'DT30: <RutaVenta> — prohibido en tipos 41, 43, 47.';

-- 36. <InformacionAdicionalEmisor>  (STRING(250))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS informacion_adicional_emisor VARCHAR(250) NULL;

COMMENT ON COLUMN invoices.informacion_adicional_emisor
    IS 'DT30: <InformacionAdicionalEmisor> — texto libre adicional del emisor.';


-- ============================================================
-- BLOQUE C — <Comprador>
-- ============================================================

-- 41. <ContactoComprador>  (STRING(80))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS contacto_comprador VARCHAR(80) NULL;

COMMENT ON COLUMN invoices.contacto_comprador
    IS 'DT30: <ContactoComprador> — prohibido en tipos 43 y 47.';

-- 42. <CorreoComprador>  (STRING(80))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS correo_comprador VARCHAR(80) NULL;

COMMENT ON COLUMN invoices.correo_comprador
    IS 'DT30: <CorreoComprador> — email. Prohibido en 43 y 47.';

-- 43. <DireccionComprador>  (STRING(100))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS direccion_comprador VARCHAR(100) NULL;

COMMENT ON COLUMN invoices.direccion_comprador
    IS 'DT30: <DireccionComprador> — prohibido en 43 y 47.';

-- 44. <MunicipioComprador>  (STRING(6), Tabla III)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS municipio_comprador VARCHAR(6) NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_municipio_comprador
    CHECK (municipio_comprador IS NULL OR municipio_comprador ~ '^[0-9]{6}$');

COMMENT ON COLUMN invoices.municipio_comprador
    IS 'DT30: <MunicipioComprador> — código DGII Tabla III (6 dígitos).';

-- 45. <ProvinciaComprador>  (STRING(6), Tabla III)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS provincia_comprador VARCHAR(6) NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_provincia_comprador
    CHECK (provincia_comprador IS NULL OR provincia_comprador ~ '^[0-9]{6}$');

COMMENT ON COLUMN invoices.provincia_comprador
    IS 'DT30: <ProvinciaComprador> — código DGII Tabla III (6 dígitos).';

-- 47. <FechaEntrega>  (DATE) — prohibido en 41, 43, 47
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fecha_entrega DATE NULL;

COMMENT ON COLUMN invoices.fecha_entrega
    IS 'DT30: <FechaEntrega> — prohibido en 41, 43, 47.';

-- 48. <ContactoEntrega>  (STRING(100))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS contacto_entrega VARCHAR(100) NULL;

COMMENT ON COLUMN invoices.contacto_entrega
    IS 'DT30: <ContactoEntrega> — prohibido en 41, 43, 47.';

-- 49. <DireccionEntrega>  (STRING(100))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS direccion_entrega VARCHAR(100) NULL;

COMMENT ON COLUMN invoices.direccion_entrega
    IS 'DT30: <DireccionEntrega> — prohibido en 41, 43, 47.';

-- 50. <TelefonoAdicional>  (STRING(12), formato xxx-xxx-xxxx)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS telefono_adicional VARCHAR(12) NULL;

COMMENT ON COLUMN invoices.telefono_adicional
    IS 'DT30: <TelefonoAdicional> — formato xxx-xxx-xxxx. Prohibido en 41, 43, 47.';

-- 51. <FechaOrdenCompra>  (DATE)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS fecha_orden_compra DATE NULL;

COMMENT ON COLUMN invoices.fecha_orden_compra
    IS 'DT30: <FechaOrdenCompra> — prohibido en 41, 43, 47.';

-- 52. <NumeroOrdenCompra>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS numero_orden_compra VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.numero_orden_compra
    IS 'DT30: <NumeroOrdenCompra> — prohibido en 41, 43, 47.';

-- 53. <CodigoInternoComprador>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS codigo_interno_comprador VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.codigo_interno_comprador
    IS 'DT30: <CodigoInternoComprador> — prohibido en 43 y 47.';

-- 54. <ResponsablePago>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS responsable_pago VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.responsable_pago
    IS 'DT30: <ResponsablePago> — prohibido en 43 y 47.';

-- 55. <Informacionadicionalcomprador>  (STRING(150))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS informacion_adicional_comprador VARCHAR(150) NULL;

COMMENT ON COLUMN invoices.informacion_adicional_comprador
    IS 'DT30: <Informacionadicionalcomprador> — prohibido en 43 y 47.';


-- ============================================================
-- BLOQUE D — <InformacionesAdicionales> (los nuevos del DT30)
-- NOTA: Las columnas info_fecha_embarque, info_numero_embarque,
-- info_numero_contenedor, info_nombre_puerto_*, etc. YA EXISTEN
-- en el modelo actual. Solo agregamos las que faltan.
-- ============================================================

-- 59. <NumeroReferencia>  (STRING(20))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_numero_referencia VARCHAR(20) NULL;

COMMENT ON COLUMN invoices.info_numero_referencia
    IS 'DT30: <NumeroReferencia> — prohibido en 41, 43, 47.';

-- 70. <PesoBruto>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_peso_bruto DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.info_peso_bruto
    IS 'DT30: <PesoBruto> — aplica a 31,32,33,34,44,45,46.';

-- 71. <PesoNeto>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_peso_neto DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.info_peso_neto
    IS 'DT30: <PesoNeto> — aplica a 31,32,33,34,44,45,46.';

-- 72. <UnidadPesoBruto>  (SMALLINT 1-62)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_unidad_peso_bruto SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_info_unidad_peso_bruto
    CHECK (info_unidad_peso_bruto IS NULL OR (info_unidad_peso_bruto BETWEEN 1 AND 62));

COMMENT ON COLUMN invoices.info_unidad_peso_bruto
    IS 'DT30: <UnidadPesoBruto> — código Tabla IV (1-62).';

-- 73. <UnidadPesoNeto>  (SMALLINT 1-62)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_unidad_peso_neto SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_info_unidad_peso_neto
    CHECK (info_unidad_peso_neto IS NULL OR (info_unidad_peso_neto BETWEEN 1 AND 62));

COMMENT ON COLUMN invoices.info_unidad_peso_neto
    IS 'DT30: <UnidadPesoNeto> — código Tabla IV (1-62).';

-- 74. <CantidadBulto>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_cantidad_bulto DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.info_cantidad_bulto
    IS 'DT30: <CantidadBulto> — aplica a 31,32,33,34,44,45,46.';

-- 75. <UnidadBulto>  (SMALLINT 1-62)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_unidad_bulto SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_info_unidad_bulto
    CHECK (info_unidad_bulto IS NULL OR (info_unidad_bulto BETWEEN 1 AND 62));

COMMENT ON COLUMN invoices.info_unidad_bulto
    IS 'DT30: <UnidadBulto> — código Tabla IV (1-62).';

-- 76. <VolumenBulto>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_volumen_bulto DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.info_volumen_bulto
    IS 'DT30: <VolumenBulto> — aplica a 31,32,33,34,44,45,46.';

-- 77. <UnidadVolumen>  (SMALLINT 1-62)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS info_unidad_volumen SMALLINT NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_info_unidad_volumen
    CHECK (info_unidad_volumen IS NULL OR (info_unidad_volumen BETWEEN 1 AND 62));

COMMENT ON COLUMN invoices.info_unidad_volumen
    IS 'DT30: <UnidadVolumen> — código Tabla IV (1-62).';


-- ============================================================
-- BLOQUE E — <Totales> (los nuevos del DT30)
-- ============================================================

-- 104. <MontoImpuestoAdicional>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_impuesto_adicional DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.monto_impuesto_adicional
    IS 'DT30: <MontoImpuestoAdicional> — suma de todos los impuestos adicionales.';

-- 105-109. <ImpuestosAdicionales>  (tabla, hasta 20)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS impuestos_adicionales JSONB NULL;

COMMENT ON COLUMN invoices.impuestos_adicionales
    IS 'DT30: <ImpuestosAdicionales> — array JSON [{codigo:'001'-'039', tasa, iscEspecifico, iscAdvalorem, otros}] máx 20. Ver tabla I en constants/additionalTaxes.js.';

-- 111. <MontoNoFacturable>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_no_facturable DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.monto_no_facturable
    IS 'DT30: <MontoNoFacturable> — suma de ítems con indicadorFacturacion=0.';

-- 112. <MontoPeriodo>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_periodo DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.monto_periodo
    IS 'DT30: <MontoPeriodo> — MontoTotal + MontoNoFacturable.';

-- 113. <SaldoAnterior>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS saldo_anterior DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.saldo_anterior
    IS 'DT30: <SaldoAnterior> — saldo del período anterior.';

-- 114. <MontoAvancePago>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_avance_pago DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.monto_avance_pago
    IS 'DT30: <MontoAvancePago> — pagos anticipados aplicados.';

-- 115. <ValorPagar>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS valor_pagar DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.valor_pagar
    IS 'DT30: <ValorPagar> — MontoTotal - MontoAvancePago ± SaldoAnterior.';

-- 118. <TotalITBISPercepcion>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_percepcion DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.total_itbis_percepcion
    IS 'DT30: <TotalITBISPercepcion> — percepción de ITBIS (31,33,34,41).';

-- 119. <TotalISRPercepcion>  (DECIMAL(15,2))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_isr_percepcion DECIMAL(15, 2) NULL;

COMMENT ON COLUMN invoices.total_isr_percepcion
    IS 'DT30: <TotalISRPercepcion> — percepción de ISR (31,33,34,41).';


-- ============================================================
-- BLOQUE F — <OtraMoneda> (encabezado)
-- ============================================================

-- 120. <TipoMoneda>  (STRING(3))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tipo_moneda VARCHAR(3) NULL;

COMMENT ON COLUMN invoices.tipo_moneda
    IS 'DT30: <TipoMoneda> — código ISO 4217 (USD, EUR, etc). Null = DOP (no se emite el bloque OtraMoneda). Ver constants/currencies.js.';

-- 121. <TipoCambio>  (DECIMAL(10,4))
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tipo_cambio DECIMAL(10, 4) NULL;

ALTER TABLE invoices
    ADD CONSTRAINT chk_invoices_tipo_cambio
    CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);

COMMENT ON COLUMN invoices.tipo_cambio
    IS 'DT30: <TipoCambio> — obligatorio si tipo_moneda no es null.';

-- 122. <MontoGravadoTotalOtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_gravado_total_otra_moneda DECIMAL(15, 2) NULL;

-- 123. <MontoGravado1OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_gravado_1_otra_moneda DECIMAL(15, 2) NULL;

-- 124. <MontoGravado2OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_gravado_2_otra_moneda DECIMAL(15, 2) NULL;

-- 125. <MontoGravado3OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_gravado_3_otra_moneda DECIMAL(15, 2) NULL;

-- 126. <MontoExentoOtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_exento_otra_moneda DECIMAL(15, 2) NULL;

-- 127. <TotalITBISOtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_otra_moneda DECIMAL(15, 2) NULL;

-- 128. <TotalITBIS1OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_1_otra_moneda DECIMAL(15, 2) NULL;

-- 129. <TotalITBIS2OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_2_otra_moneda DECIMAL(15, 2) NULL;

-- 130. <TotalITBIS3OtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS total_itbis_3_otra_moneda DECIMAL(15, 2) NULL;

-- 131. <MontoImpuestoAdicionalOtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_impuesto_adicional_otra_moneda DECIMAL(15, 2) NULL;

-- 132-136. <ImpuestosAdicionalesOtraMoneda>  (tabla)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS impuestos_adicionales_otra_moneda JSONB NULL;

COMMENT ON COLUMN invoices.impuestos_adicionales_otra_moneda
    IS 'DT30: <ImpuestosAdicionalesOtraMoneda> — array JSON [{codigo, tasa, iscEspecifico, iscAdvalorem, otros}] máx 20.';

-- 137. <MontoTotalOtraMoneda>
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS monto_total_otra_moneda DECIMAL(15, 2) NULL;


COMMIT;

-- ============================================================
-- ROLLBACK (por si necesitas revertir)
-- ============================================================
-- Nota: borra los constraints primero, luego las columnas.
-- Ver archivo inverso o pedir a quien lo creó.
-- (Es muy largo para pegar aquí, se puede generar con:
--  SELECT 'ALTER TABLE invoices DROP COLUMN IF EXISTS '||column_name||';'
--  FROM information_schema.columns
--  WHERE table_name='invoices'
--    AND column_name IN (...);
-- )

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- SELECT column_name, data_type, character_maximum_length, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'invoices'
--   AND column_name IN (
--     'indicador_envio_diferido','indicador_monto_gravado','indicador_servicio_todo_incluido',
--     'tipo_ingresos','tipo_pago','fecha_limite_pago','termino_pago','formas_pago',
--     'tipo_cuenta_pago','numero_cuenta_pago','banco_pago',
--     'fecha_desde','fecha_hasta','total_paginas',
--     'codigo_vendedor','numero_factura_interna','numero_pedido_interno',
--     'zona_venta','ruta_venta','informacion_adicional_emisor',
--     'contacto_comprador','correo_comprador','direccion_comprador',
--     'municipio_comprador','provincia_comprador',
--     'fecha_entrega','contacto_entrega','direccion_entrega','telefono_adicional',
--     'fecha_orden_compra','numero_orden_compra','codigo_interno_comprador',
--     'responsable_pago','informacion_adicional_comprador',
--     'info_numero_referencia','info_peso_bruto','info_peso_neto',
--     'info_unidad_peso_bruto','info_unidad_peso_neto',
--     'info_cantidad_bulto','info_unidad_bulto','info_volumen_bulto','info_unidad_volumen',
--     'monto_impuesto_adicional','impuestos_adicionales',
--     'monto_no_facturable','monto_periodo','saldo_anterior',
--     'monto_avance_pago','valor_pagar',
--     'total_itbis_percepcion','total_isr_percepcion',
--     'tipo_moneda','tipo_cambio',
--     'monto_gravado_total_otra_moneda','monto_gravado_1_otra_moneda',
--     'monto_gravado_2_otra_moneda','monto_gravado_3_otra_moneda',
--     'monto_exento_otra_moneda','total_itbis_otra_moneda',
--     'total_itbis_1_otra_moneda','total_itbis_2_otra_moneda','total_itbis_3_otra_moneda',
--     'monto_impuesto_adicional_otra_moneda','impuestos_adicionales_otra_moneda',
--     'monto_total_otra_moneda'
--   )
-- ORDER BY column_name;