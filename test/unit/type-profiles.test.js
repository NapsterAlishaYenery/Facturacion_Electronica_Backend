// test/unit/type-profiles.test.js
//
// Verifica que los 10 perfiles de type-profiles.js sean coherentes
// con la estructura declarada en los XSD oficiales de la DGII.
//
// Este test NO usa el builder. Solo valida:
//   1. Coherencia interna del perfil (campos requeridos, tipos válidos).
//   2. Coincidencia con lo declarado en el XSD (elementos presentes,
//      obligatoriedad, orden de bloques).

'use strict';

const fs = require('fs');
const path = require('path');
const libxml = require('libxmljs2');

const {
  TYPE_PROFILES,
  getTypeProfile,
  isValidType,
  getAllTypes,
} = require('../../src/modules/invoices/ecf/type-profiles');

// ============================================================
// HARNESS DE TEST
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function test(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
    failed++;
    failures.push(label);
  }
}

function describe(name, fn) {
  console.log(`\n=== ${name} ===\n`);
  fn();
}

// ============================================================
// HELPERS PARA LEER XSD
// ============================================================

const XSD_PATH_BY_TYPE = {
  '31': 'docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd',
  '32': 'docs/dgii/xsd/ecf32/e-CF 32 v.1.0.xsd',
  '33': 'docs/dgii/xsd/ecf33/e-CF 33 v.1.0.xsd',
  '34': 'docs/dgii/xsd/ecf34/e-CF 34 v.1.0.xsd',
  '41': 'docs/dgii/xsd/ecf41/e-CF 41 v.1.0.xsd',
  '43': 'docs/dgii/xsd/ecf43/e-CF 43 v.1.0.xsd',
  '44': 'docs/dgii/xsd/ecf44/e-CF 44 v.1.0.xsd',
  '45': 'docs/dgii/xsd/ecf45/e-CF 45 v.1.0.xsd',
  '46': 'docs/dgii/xsd/ecf46/e-CF 46 v.1.0.xsd',
  '47': 'docs/dgii/xsd/ecf47/e-CF 47 v.1.0.xsd',
};

const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema';

/**
 * Carga un XSD y devuelve el documento libxml parseado.
 */
function loadXSD(type) {
  const relPath = XSD_PATH_BY_TYPE[type];
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`XSD not found for type ${type}: ${fullPath}`);
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  // Remover BOM si lo hay
  content = content.replace(/^\uFEFF/, '');
  return libxml.parseXml(content);
}

/**
 * Devuelve el nodo <xs:element name="ECF"> dentro del schema.
 */
function getECFRoot(xsdDoc) {
  const schema = xsdDoc.root();
  if (!schema || schema.name() !== 'schema') {
    throw new Error(`XSD root is not <xs:schema> (got <${schema && schema.name()}>)`);
  }
  const ecf = schema.childNodes().find(
    (n) =>
      n.type() === 'element' &&
      n.name() === 'element' &&
      n.attr('name')?.value() === 'ECF'
  );
  if (!ecf) {
    throw new Error('No <xs:element name="ECF"> found in schema');
  }
  return ecf;
}

/**
 * Dentro del XSD, <xs:element name="ECF">/<xs:complexType>/<xs:sequence>/<xs:element name="Encabezado">
 */
function getEncabezadoNode(xsdDoc) {
  const ecf = getECFRoot(xsdDoc);
  const complexType = ecf.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'complexType'
  );
  if (!complexType) throw new Error('No complexType in ECF');
  const sequence = complexType.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'sequence'
  );
  if (!sequence) throw new Error('No sequence in ECF complexType');
  const encabezado = sequence.childNodes().find(
    (n) =>
      n.type() === 'element' &&
      n.name() === 'element' &&
      n.attr('name')?.value() === 'Encabezado'
  );
  if (!encabezado) throw new Error('No Encabezado in ECF sequence');
  return encabezado;
}

/**
 * Dado un nodo <xs:element> contenedor, devuelve la lista de nombres de sus hijos
 * inmediatos dentro de su propia <xs:sequence>.
 */
function getChildElementNames(parentElementNode) {
  const ct = parentElementNode.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'complexType'
  );
  if (!ct) return [];
  const seq = ct.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'sequence'
  );
  if (!seq) return [];
  return seq
    .childNodes()
    .filter((n) => n.type() === 'element' && n.name() === 'element')
    .map((n) => n.attr('name')?.value());
}

/**
 * Devuelve el minOccurs real (con default=1) de un elemento hijo por nombre.
 */
function getMinOccurs(parentElementNode, childName) {
  const ct = parentElementNode.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'complexType'
  );
  if (!ct) return null;
  const seq = ct.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'sequence'
  );
  if (!seq) return null;
  const child = seq.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'element' && n.attr('name')?.value() === childName
  );
  if (!child) return null;
  const mo = child.attr('minOccurs')?.value();
  return mo === undefined ? 1 : Number(mo);
}

/**
 * Busca un elemento por nombre dentro de un contenedor con complexType/sequence.
 */
function findChildElement(parentElementNode, childName) {
  const ct = parentElementNode.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'complexType'
  );
  if (!ct) return null;
  const seq = ct.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'sequence'
  );
  if (!seq) return null;
  return seq.childNodes().find(
    (n) => n.type() === 'element' && n.name() === 'element' && n.attr('name')?.value() === childName
  ) || null;
}

/**
 * Devuelve el nodo <IdDoc>, <Emisor>, <Comprador>, <Transporte>, <Totales>,
 * <InformacionesAdicionales> del <Encabezado>.
 */
function getEncabezadoChild(encabezadoNode, childName) {
  return findChildElement(encabezadoNode, childName);
}

// ============================================================
// TESTS: ESTRUCTURA DE LOS PERFILES
// ============================================================

describe('Type profiles — estructura básica', () => {
  test('hay 10 tipos definidos', getAllTypes().length === 10);
  test(
    'todos los tipos esperados existen',
    ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'].every((t) =>
      isValidType(t)
    )
  );
  test('isValidType rechaza tipo inexistente', !isValidType('99'));

  for (const type of ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47']) {
    const p = getTypeProfile(type);
    test(`perfil ${type} tiene code === "${type}"`, p.code === type);
    test(`perfil ${type} tiene name no vacío`, typeof p.name === 'string' && p.name.length > 0);
    test(`perfil ${type} tiene idDoc`, p.idDoc && typeof p.idDoc === 'object');
    test(`perfil ${type} tiene comprador`, p.comprador && typeof p.comprador === 'object');
    test(`perfil ${type} tiene totales`, p.totales && typeof p.totales === 'object');
    test(`perfil ${type} tiene items`, p.items && typeof p.items === 'object');
    test(`perfil ${type} tiene informacionReferencia`, p.informacionReferencia && typeof p.informacionReferencia === 'object');
    test(`perfil ${type} tiene taxRules`, p.taxRules && typeof p.taxRules === 'object');
    test(`perfil ${type} tiene taxRules.isNota`, typeof p.taxRules.isNota === 'boolean');
    test(`perfil ${type} tiene taxRules.itbisTransparente`, typeof p.taxRules.itbisTransparente === 'boolean');
  }
});

// ============================================================
// TESTS: CONSISTENCIA INTERNA
// ============================================================

describe('Type profiles — consistencia interna', () => {
  // 33 y 34 son notas
  test('33 es nota', getTypeProfile('33').taxRules.isNota === true);
  test('34 es nota', getTypeProfile('34').taxRules.isNota === true);
  test('31 NO es nota', getTypeProfile('31').taxRules.isNota === false);
  test('32 NO es nota', getTypeProfile('32').taxRules.isNota === false);

  // 33 y 34 tienen InformacionReferencia obligatorio
  test('33 tiene InformacionReferencia required', getTypeProfile('33').informacionReferencia.required === true);
  test('34 tiene InformacionReferencia required', getTypeProfile('34').informacionReferencia.required === true);
  test('31 NO tiene InformacionReferencia required', getTypeProfile('31').informacionReferencia.required === false);

  // 34 tiene IndicadorNotaCredito
  test('34 tiene hasIndicadorNotaCredito', getTypeProfile('34').idDoc.hasIndicadorNotaCredito === true);
  test('33 NO tiene hasIndicadorNotaCredito', !getTypeProfile('33').idDoc.hasIndicadorNotaCredito);

  // 32 no tiene FechaVencimientoSecuencia
  test('32 NO tiene FechaVencimientoSecuencia', getTypeProfile('32').idDoc.hasFechaVencimientoSecuencia === false);
  // 34 tampoco
  test('34 NO tiene FechaVencimientoSecuencia', getTypeProfile('34').idDoc.hasFechaVencimientoSecuencia === false);
  // 31 sí
  test('31 SÍ tiene FechaVencimientoSecuencia', getTypeProfile('31').idDoc.hasFechaVencimientoSecuencia === true);

  // 34 no tiene TablaFormasPago
  test('34 NO tiene TablaFormasPago', getTypeProfile('34').idDoc.hasTablaFormasPago === false);

  // 43 y 44 no tienen ITBIS
  test('43 itbisTransparente = false', getTypeProfile('43').taxRules.itbisTransparente === false);
  test('44 itbisTransparente = false', getTypeProfile('44').taxRules.itbisTransparente === false);
  test('43 tiene itbisObligatorioCero', getTypeProfile('43').taxRules.itbisObligatorioCero === true);
  test('44 tiene itbisObligatorioCero', getTypeProfile('44').taxRules.itbisObligatorioCero === true);

  // 46 es exportación
  test('46 isExportacion', getTypeProfile('46').taxRules.isExportacion === true);
  test('46 tiene Transporte extendido', getTypeProfile('46').transporte.extended === true);
  test('46 tiene InformacionesAdicionales extendido', getTypeProfile('46').informacionesAdicionales.extended === true);

  // 47 es pago al exterior
  test('47 isPagoExterior', getTypeProfile('47').taxRules.isPagoExterior === true);
  test('47 tiene retención obligatoria', getTypeProfile('47').taxRules.retencionObligatoria === true);

  // 41 es autofactura con retención obligatoria
  test('41 isAutofactura', getTypeProfile('41').taxRules.isAutofactura === true);
  test('41 tiene retención obligatoria', getTypeProfile('41').taxRules.retencionObligatoria === true);
  test('41 Retencion en items es required', getTypeProfile('41').items.retencionRequired === true);

  // 43 no tiene Comprador
  test('43 NO tiene Comprador', getTypeProfile('43').comprador.present === false);
});

// ============================================================
// TESTS: COINCIDENCIA CON LOS XSD
// ============================================================

describe('Type profiles vs XSD — Encabezado/IdDoc', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    let xsdDoc;
    try {
      xsdDoc = loadXSD(type);
    } catch (e) {
      test(`XSD ${type} carga`, false, e.message);
      continue;
    }

    const encabezado = getEncabezadoNode(xsdDoc);
    const iddocNode = getEncabezadoChild(encabezado, 'IdDoc');
    test(`XSD ${type} tiene IdDoc`, iddocNode !== null);

    if (!iddocNode) continue;

    const idDocChildren = getChildElementNames(iddocNode);

    // Verificar que los flags del perfil correspondan a lo que está en el XSD
    const checks = [
      ['hasFechaVencimientoSecuencia', 'FechaVencimientoSecuencia'],
      ['hasIndicadorEnvioDiferido', 'IndicadorEnvioDiferido'],
      ['hasIndicadorMontoGravado', 'IndicadorMontoGravado'],
      ['hasIndicadorServicioTodoIncluido', 'IndicadorServicioTodoIncluido'],
      ['hasTipoIngresos', 'TipoIngresos'],
      ['hasTipoPago', 'TipoPago'],
      ['hasFechaLimitePago', 'FechaLimitePago'],
      ['hasTerminoPago', 'TerminoPago'],
      ['hasTablaFormasPago', 'TablaFormasPago'],
      ['hasTipoCuentaPago', 'TipoCuentaPago'],
      ['hasNumeroCuentaPago', 'NumeroCuentaPago'],
      ['hasBancoPago', 'BancoPago'],
      ['hasFechaDesde', 'FechaDesde'],
      ['hasFechaHasta', 'FechaHasta'],
      ['hasTotalPaginas', 'TotalPaginas'],
    ];

    for (const [flag, xsdElement] of checks) {
      const profileHas = profile.idDoc[flag] === true;
      const xsdHas = idDocChildren.includes(xsdElement);
      test(
        `${type}: idDoc.${flag} (${profileHas}) === XSD tiene <${xsdElement}> (${xsdHas})`,
        profileHas === xsdHas
      );
    }

    // Caso especial: 34 tiene IndicadorNotaCredito
    if (type === '34') {
      test('34: XSD tiene IndicadorNotaCredito', idDocChildren.includes('IndicadorNotaCredito'));
      test('34: perfil tiene hasIndicadorNotaCredito', profile.idDoc.hasIndicadorNotaCredito === true);
    } else {
      test(`${type}: perfil NO declara hasIndicadorNotaCredito`, !profile.idDoc.hasIndicadorNotaCredito);
    }
  }
});

describe('Type profiles vs XSD — Comprador', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);
    const encabezado = getEncabezadoNode(xsdDoc);
    const compradorNode = getEncabezadoChild(encabezado, 'Comprador');

    const xsdHasComprador = compradorNode !== null;
    const profileHasComprador = profile.comprador.present === true;

    test(
      `${type}: comprador.present (${profileHasComprador}) === XSD tiene <Comprador> (${xsdHasComprador})`,
      profileHasComprador === xsdHasComprador
    );

    if (xsdHasComprador && compradorNode) {
      const rncMin = getMinOccurs(compradorNode, 'RNCComprador');
      const razonMin = getMinOccurs(compradorNode, 'RazonSocialComprador');

      test(
        `${type}: comprador.rncRequired (${profile.comprador.rncRequired}) === XSD RNCComprador minOccurs=${rncMin}`,
        profile.comprador.rncRequired === (rncMin === 1)
      );
      test(
        `${type}: comprador.razonSocialRequired (${profile.comprador.razonSocialRequired}) === XSD RazonSocialComprador minOccurs=${razonMin}`,
        profile.comprador.razonSocialRequired === (razonMin === 1)
      );
    }
  }
});

describe('Type profiles vs XSD — Transporte', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);
    const encabezado = getEncabezadoNode(xsdDoc);
    const transporteNode = getEncabezadoChild(encabezado, 'Transporte');

    const xsdHasTransporte = transporteNode !== null;
    const profileHasTransporte = profile.hasTransporteBlock === true;

    test(
      `${type}: hasTransporteBlock (${profileHasTransporte}) === XSD tiene <Transporte> (${xsdHasTransporte})`,
      profileHasTransporte === xsdHasTransporte
    );

    if (xsdHasTransporte && transporteNode) {
      const children = getChildElementNames(transporteNode);

      // 46 → transporte extendido (ViaTransporte + PaisOrigen + PaisDestino + …)
      if (type === '46') {
        test('46: Transporte tiene ViaTransporte', children.includes('ViaTransporte'));
        test('46: Transporte tiene PaisOrigen', children.includes('PaisOrigen'));
        test('46: Transporte tiene PaisDestino', children.includes('PaisDestino'));
      }
      // 47 → transporte reducido (solo PaisDestino)
      else if (type === '47') {
        test('47: Transporte tiene solo PaisDestino', children.length === 1 && children[0] === 'PaisDestino');
      }
      // resto → transporte full (los 7 campos clásicos)
      else {
        const fullFields = [
          'Conductor',
          'DocumentoTransporte',
          'Ficha',
          'Placa',
          'RutaTransporte',
          'ZonaTransporte',
          'NumeroAlbaran',
        ];
        const allPresent = fullFields.every((f) => children.includes(f));
        test(`${type}: Transporte full tiene los 7 campos clásicos`, allPresent);
      }
    }
  }
});

describe('Type profiles vs XSD — InformacionReferencia', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);

    // InformacionReferencia está al nivel de ECF, no dentro de Encabezado.
    const ecf = getECFRoot(xsdDoc);
    const ecfCT = ecf.childNodes().find((n) => n.type() === 'element' && n.name() === 'complexType');
    const ecfSeq = ecfCT.childNodes().find((n) => n.type() === 'element' && n.name() === 'sequence');
    const infoRef = ecfSeq.childNodes().find(
      (n) => n.type() === 'element' && n.name() === 'element' && n.attr('name')?.value() === 'InformacionReferencia'
    );

    const xsdHas = infoRef !== null;
    const profileHas = profile.informacionReferencia.present === true;

    test(
      `${type}: informacionReferencia.present (${profileHas}) === XSD tiene <InformacionReferencia> (${xsdHas})`,
      profileHas === xsdHas
    );

    if (xsdHas && infoRef) {
      const min = infoRef.attr('minOccurs')?.value();
      const isRequired = min !== undefined && Number(min) >= 1;
      test(
        `${type}: informacionReferencia.required (${profile.informacionReferencia.required}) === XSD minOccurs>=1 (${isRequired})`,
        profile.informacionReferencia.required === isRequired
      );
    }
  }
});

describe('Type profiles vs XSD — Totales', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);
    const encabezado = getEncabezadoNode(xsdDoc);
    const totalesNode = getEncabezadoChild(encabezado, 'Totales');
    test(`XSD ${type} tiene Totales`, totalesNode !== null);
    if (!totalesNode) continue;

    const totalesChildren = getChildElementNames(totalesNode);

    const checks = [
      ['hasMontoGravadoTotal', 'MontoGravadoTotal'],
      ['hasMontoGravadoI1', 'MontoGravadoI1'],
      ['hasMontoGravadoI2', 'MontoGravadoI2'],
      ['hasMontoGravadoI3', 'MontoGravadoI3'],
      ['hasMontoExento', 'MontoExento'],
      ['hasITBIS1', 'ITBIS1'],
      ['hasITBIS2', 'ITBIS2'],
      ['hasITBIS3', 'ITBIS3'],
      ['hasTotalITBIS', 'TotalITBIS'],
      ['hasTotalITBIS1', 'TotalITBIS1'],
      ['hasTotalITBIS2', 'TotalITBIS2'],
      ['hasTotalITBIS3', 'TotalITBIS3'],
      ['hasMontoImpuestoAdicional', 'MontoImpuestoAdicional'],
      ['hasImpuestosAdicionales', 'ImpuestosAdicionales'],
    ];

    for (const [flag, xsdElement] of checks) {
      const profileHas = profile.totales[flag] === true;
      const xsdHas = totalesChildren.includes(xsdElement);
      test(
        `${type}: totales.${flag} (${profileHas}) === XSD tiene <${xsdElement}> (${xsdHas})`,
        profileHas === xsdHas
      );
    }

    // Retenciones a nivel Totales (TotalITBISRetenido, etc.)
    const xsdHasRetenciones =
      totalesChildren.includes('TotalITBISRetenido') ||
      totalesChildren.includes('TotalISRRetencion');
    test(
      `${type}: totales.hasRetenciones (${profile.totales.hasRetenciones}) === XSD tiene alguno de [TotalITBISRetenido, TotalISRRetencion] (${xsdHasRetenciones})`,
      profile.totales.hasRetenciones === xsdHasRetenciones
    );
  }
});

describe('Type profiles vs XSD — DetallesItems/Item', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);

    // Navegar ECF > DetallesItems > Item
    const ecf = getECFRoot(xsdDoc);
    const ecfCT = ecf.childNodes().find((n) => n.type() === 'element' && n.name() === 'complexType');
    const ecfSeq = ecfCT.childNodes().find((n) => n.type() === 'element' && n.name() === 'sequence');
    const detalles = ecfSeq.childNodes().find(
      (n) => n.type() === 'element' && n.name() === 'element' && n.attr('name')?.value() === 'DetallesItems'
    );
    test(`XSD ${type} tiene DetallesItems`, detalles !== null);
    if (!detalles) continue;

    const itemNode = findChildElement(detalles, 'Item');
    test(`XSD ${type} tiene Item`, itemNode !== null);
    if (!itemNode) continue;

    const itemChildren = getChildElementNames(itemNode);

    // Retención
    const xsdHasRetencion = itemChildren.includes('Retencion');
    const profileHasRetencion = profile.items.hasRetencion === true;
    test(
      `${type}: items.hasRetencion (${profileHasRetencion}) === XSD tiene <Retencion> (${xsdHasRetencion})`,
      profileHasRetencion === xsdHasRetencion
    );

    if (xsdHasRetencion) {
      const retMin = getMinOccurs(itemNode, 'Retencion');
      const isRequired = retMin === 1;
      const profileRequired = profile.items.retencionRequired === true;
      test(
        `${type}: items.retencionRequired (${profileRequired}) === XSD Retencion minOccurs=1 (${isRequired})`,
        profileRequired === isRequired
      );
    }

    // Mineria
    const xsdHasMineria = itemChildren.includes('Mineria');
    test(
      `${type}: items.hasMineria (${profile.items.hasMineria}) === XSD tiene <Mineria> (${xsdHasMineria})`,
      profile.items.hasMineria === xsdHasMineria
    );

    // GradosAlcohol
    const xsdHasGrados = itemChildren.includes('GradosAlcohol');
    test(
      `${type}: items.hasGradosAlcohol (${profile.items.hasGradosAlcohol}) === XSD tiene <GradosAlcohol> (${xsdHasGrados})`,
      profile.items.hasGradosAlcohol === xsdHasGrados
    );

    // DescuentoMonto
    const xsdHasDesc = itemChildren.includes('DescuentoMonto');
    test(
      `${type}: items.hasDescuento (${profile.items.hasDescuento}) === XSD tiene <DescuentoMonto> (${xsdHasDesc})`,
      profile.items.hasDescuento === xsdHasDesc
    );

    // TablaSubDescuento
    const xsdHasTablaDesc = itemChildren.includes('TablaSubDescuento');
    test(
      `${type}: items.hasTablaSubDescuento (${profile.items.hasTablaSubDescuento}) === XSD tiene <TablaSubDescuento> (${xsdHasTablaDesc})`,
      profile.items.hasTablaSubDescuento === xsdHasTablaDesc
    );

    // RecargoMonto
    const xsdHasRecargo = itemChildren.includes('RecargoMonto');
    test(
      `${type}: items.hasRecargo (${profile.items.hasRecargo}) === XSD tiene <RecargoMonto> (${xsdHasRecargo})`,
      profile.items.hasRecargo === xsdHasRecargo
    );
  }
});

describe('Type profiles vs XSD — Emisor', () => {
  for (const type of getAllTypes()) {
    const profile = getTypeProfile(type);
    const xsdDoc = loadXSD(type);
    const encabezado = getEncabezadoNode(xsdDoc);
    const emisorNode = getEncabezadoChild(encabezado, 'Emisor');
    test(`XSD ${type} tiene Emisor`, emisorNode !== null);
    if (!emisorNode) continue;

    const emisorChildren = getChildElementNames(emisorNode);

    const hasCodigoVendedor = emisorChildren.includes('CodigoVendedor');
    test(
      `${type}: emisor.hasCodigoVendedor (${profile.emisor.hasCodigoVendedor}) === XSD tiene <CodigoVendedor> (${hasCodigoVendedor})`,
      profile.emisor.hasCodigoVendedor === hasCodigoVendedor
    );

    const hasZonaVenta = emisorChildren.includes('ZonaVenta');
    test(
      `${type}: emisor.hasZonaVenta (${profile.emisor.hasZonaVenta}) === XSD tiene <ZonaVenta> (${hasZonaVenta})`,
      profile.emisor.hasZonaVenta === hasZonaVenta
    );

    const hasRutaVenta = emisorChildren.includes('RutaVenta');
    test(
      `${type}: emisor.hasRutaVenta (${profile.emisor.hasRutaVenta}) === XSD tiene <RutaVenta> (${hasRutaVenta})`,
      profile.emisor.hasRutaVenta === hasRutaVenta
    );
  }
});

// ============================================================
// RESULTADO
// ============================================================

console.log(`\n========================================`);
console.log(`RESULTADO FINAL: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  console.log('Fallos:');
  for (const f of failures) console.log(`  - ${f}`);
}

process.exit(failed > 0 ? 1 : 0);