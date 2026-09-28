# Parches aplicados a XSD oficiales de DGII

Este proyecto consume los XSD oficiales de la DGII para validar
comprobantes fiscales electrónicos. Algunos XSD publicados tienen
errores que impiden su compilación. Los parches se aplican
manualmente con scripts para mantener trazabilidad.

## Lista de parches

### 1. XSD e-CF 31 v.1.0 — espacio espurio en `name`

**Archivo**: `docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd`
**Script**: `scripts/fix-xsd31-space-in-name.js`
**Reporte**: `docs/dgii/INCIDENCIA-XSD-31.md`

**Problema**: `<xs:simpleType name=" IndicadorServicioTodoIncluidoType">`
tiene un espacio al inicio del `name`, lo que impide que el tipo
sea resuelto por el elemento que lo referencia.

**Solución**: eliminar el espacio.

**Estado**: parcheado localmente. Pendiente de corrección oficial
por DGII.

## Cómo aplicar todos los parches

    node scripts/apply-all-patches.js

O individualmente:

    node scripts/fix-xsd31-space-in-name.js