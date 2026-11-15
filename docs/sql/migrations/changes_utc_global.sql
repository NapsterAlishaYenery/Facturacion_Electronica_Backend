-- ============================================================
-- MIGRACIÓN: Configuración de timezone para producción
-- Fecha: 2026-11-13
-- Autor: [tu nombre]
-- Descripción: Establecer timezone de la BD a UTC para
--              consistencia de fechas (certificados, facturas).
-- ============================================================
-- EJECUTAR EN: cada base de datos (local, staging, producción)
-- EJECUTAR UNA VEZ (idempotente)
-- ============================================================

-- 1. Cambiar timezone a nivel de base de datos (persistente)
ALTER DATABASE facturacion_electronica SET timezone = 'UTC';

-- 2. Verificación
-- SHOW timezone;  → debe devolver 'UTC'