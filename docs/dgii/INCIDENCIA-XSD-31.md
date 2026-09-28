# Reporte de Incidencia — XSD e-CF 31 v.1.0

**Fecha**: 27/09/2026
**Reportado por**: Guerlmy Alexander Nuñez / Expedinap
**RNC**: 02800918407
**Contacto**: napsterganc0201@gmail.com / (829) 836-9303

## Archivo afectado

`e-CF 31 v.1.0.xsd` — publicado por la DGII en el portal de
Facturación Electrónica.

## Descripción del problema

El archivo XSD no compila debido a un error tipográfico en la
declaración del tipo `IndicadorServicioTodoIncluidoType`.

En la línea [N], el `simpleType` está declarado con un espacio
al inicio del atributo `name`:

    <xs:simpleType name=" IndicadorServicioTodoIncluidoType">

                    ^^^ espacio espurio

Sin embargo, el elemento que lo referencia en el mismo archivo:

    <xs:element name="IndicadorServicioTodoIncluido"
                type="IndicadorServicioTodoIncluidoType"
                minOccurs="0" maxOccurs="1"/>

referencia el tipo SIN el espacio, por lo que la resolución del
QName falla.

## Impacto

- El XSD no compila con ningún validador estándar (libxml2, xmllint,
  Saxon, .NET XmlSchemaSet, etc.).
- Impide validar cualquier e-CF tipo 31 contra el esquema oficial.
- El XSD del tipo 32 NO tiene este problema (sirve como referencia
  del tipo correcto).

## Evidencia

Salida de `xmllint`:

    file_0.xsd:18: element element: Schemas parser error :
    element decl. 'IndicadorServicioTodoIncluido', attribute 'type':
    The QName value 'IndicadorServicioTodoIncluidoType' does not
    resolve to a(n) type definition.
    WXS schema file_0.xsd failed to compile

## Solución propuesta

Eliminar el espacio espurio en el atributo `name`:

    <!-- Antes -->
    <xs:simpleType name=" IndicadorServicioTodoIncluidoType">

    <!-- Después -->
    <xs:simpleType name="IndicadorServicioTodoIncluidoType">

El tipo correcto ya existe en el XSD del e-CF 32 v.1.0 con la
sintaxis esperada, por lo que basta con replicar esa definición.

## Solicitud

Se solicita la corrección del archivo `e-CF 31 v.1.0.xsd` en la
próxima revisión de los esquemas oficiales.

## Solución temporal aplicada

Mientras tanto, hemos aplicado un parche local al XSD para poder
compilar los esquemas. El parche está documentado en el archivo
`PATCHES.md` del repositorio y se aplica automáticamente con el
script `scripts/fix-xsd31-space-in-name.js`.