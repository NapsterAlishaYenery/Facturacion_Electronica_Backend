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

---

### 2. XSD e-CF 31, 32, 33 y 34 — `<xs:any>` obligatorio antes de la firma

**Archivos**:
- `docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd`
- `docs/dgii/xsd/ecf32/e-CF 32 v.1.0.xsd`
- `docs/dgii/xsd/ecf33/e-CF 33 v.1.0.xsd`
- `docs/dgii/xsd/ecf34/e-CF 34 v.1.0.xsd`

**Script**: `scripts/fix-xsd-any-optional.js`

**Problema**: Los 4 XSD declaran al final del `<ECF>`:

    <xs:any minOccurs="1" maxOccurs="1" processContents="skip"/>

Este `xs:any` está reservado por la DGII para la **firma digital
XMLDSig** que se inserta después de `<FechaHoraFirma>`. Con
`minOccurs="1"` el XML sin firmar NO valida contra el esquema.

**Solución temporal**: cambiar a `minOccurs="0"` para permitir XML
sin firma durante el desarrollo y testing. **Este parche debe
revertirse cuando se integre el certificado digital Viafirma y se
implemente el firmado del XML**.

**Estado**: parcheado localmente. **Pendiente de revertir al integrar
firma digital**.

**Cómo revertir**: restaurar los XSD originales desde el ZIP oficial
publicado por la DGII en el portal de Facturación Electrónica.

---


## Cómo aplicar todos los parches

    node scripts/apply-all-patches.js

O individualmente:

    node scripts/fix-xsd31-space-in-name.js