// ============================================================
// Generador de XML para e-CF (Comprobantes Fiscales Electrónicos)
// Este módulo es invocado por invoices.service.js
// NO es un módulo HTTP. NO tiene rutas ni controladores.
// ============================================================

// ============================================================
// HELPERS INTERNOS DEL MÓDULO (no se exportan)
// ============================================================

// ------------------------------------------------------------
// Formatea una fecha a dd-MM-yyyy (UTC)
// ------------------------------------------------------------
function fmtDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// ------------------------------------------------------------
// Formatea una fecha+hora a dd-MM-yyyy HH:mm:ss (UTC)
// ------------------------------------------------------------
function fmtDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

// ------------------------------------------------------------
// Formatea un monto a 2 decimales con punto
// ------------------------------------------------------------
function fmtMoney(num) {
  return Number(num || 0).toFixed(2);
}

// ------------------------------------------------------------
// Formatea una cantidad a 2 decimales con punto
// ------------------------------------------------------------
function fmtQuantity(num) {
  return Number(num || 0).toFixed(2);
}

// ------------------------------------------------------------
// Determina el IndicadorFacturacion según la tasa de ITBIS
// 1: ITBIS 18%, 2: ITBIS 16%, 3: ITBIS 0%, 4: Exento, 0: No Facturable
// ------------------------------------------------------------
function getIndicadorFacturacion(itbisRate) {
  if (itbisRate === null || itbisRate === undefined) return 4;
  const rate = Number(itbisRate);
  if (rate === 18) return 1;
  if (rate === 16) return 2;
  if (rate === 0) return 3;
  return 4; // exento
}

// ============================================================
// 1. UTILIDADES DE ESCAPADO Y LIMPIEZA XML
// ============================================================

// ------------------------------------------------------------
// Escapa caracteres especiales en texto para que sea seguro en XML
// ------------------------------------------------------------
function escapeXMLSpecialChars(text) {
  if (text === null || text === undefined) {
    return '';
  }
  const str = String(text);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ------------------------------------------------------------
// Elimina tags vacíos del XML (requisito DGII)
// ------------------------------------------------------------
function removeEmptyTags(xml) {
  if (!xml || typeof xml !== 'string') {
    return xml;
  }
  let previousXml;
  let currentXml = xml;
  do {
    previousXml = currentXml;
    currentXml = currentXml.replace(/<([a-zA-Z0-9_:]+)(\s[^>]*)?>\s*<\/\1>/g, '');
    currentXml = currentXml.replace(/<([a-zA-Z0-9_:]+)(\s[^>]*)?\/>/g, '');
  } while (currentXml !== previousXml);
  return currentXml;
}

// ============================================================
// 2. CONSTRUCCIÓN DEL CÓDIGO QR
// ============================================================

function buildQRCodeData(invoiceData) {
  const {
    issuerRnc,
    ncf,
    receiverRnc,
    total,
    issuedAt,
    type,
    signedAt,
    securityCode
  } = invoiceData;

  const totalNumber = Number(total) || 0;
  const isFC = type === '32' && totalNumber < 250000;
  const formattedTotal = totalNumber.toFixed(2);

  if (isFC) {
    const params = [
      `RncEmisor=${encodeURIComponent(issuerRnc)}`,
      `ENCF=${encodeURIComponent(ncf)}`,
      `MontoTotal=${encodeURIComponent(formattedTotal)}`,
      `CodigoSeguridad=${encodeURIComponent(securityCode || '')}`
    ].join('&');
    return `https://fc.dgii.gov.do/ecf/ConsultaTimbreFC?${params}`;
  }

  const params = [
    `RncEmisor=${encodeURIComponent(issuerRnc)}`,
    `RncComprador=${encodeURIComponent(receiverRnc || '')}`,
    `ENCF=${encodeURIComponent(ncf)}`,
    `FechaEmision=${encodeURIComponent(fmtDate(issuedAt))}`,
    `MontoTotal=${encodeURIComponent(formattedTotal)}`,
    `FechaFirma=${encodeURIComponent(fmtDateTime(signedAt))}`,
    `CodigoSeguridad=${encodeURIComponent(securityCode || '')}`
  ].join('&');
  return `https://ecf.dgii.gov.do/ecf/ConsultaTimbre?${params}`;
}

function extractSecurityCode(signatureValue) {
  if (!signatureValue || typeof signatureValue !== 'string') {
    return '';
  }
  return signatureValue.substring(0, 6);
}

// ============================================================
// 3. CONSTRUCTOR BASE DE e-CF (reutilizable por todos los tipos)
// ============================================================

// ------------------------------------------------------------
// Construye el cuerpo XML de un e-CF
//
// options:
//   - type: '32' | '31' | '33' | '34' | etc.
//   - requireReceiver: boolean (si true, exige RNC + Razón Social)
//
// Retorna el string XML sin firmar.
// ------------------------------------------------------------
function buildECFBody(invoiceData, options) {
  const { type, requireReceiver } = options;

  const {
    // IdDoc
    ncf,
    sequenceExpiresAt,
    // Emisor
    issuerRnc,
    issuerName,
    issuerTradeName,
    issuerAddress,
    issuerMunicipio,
    issuerProvincia,
    issuerPhone,
    issuerEmail,
    issuerWebsite,
    issuerEconomicActivity,
    // Comprador
    receiverRnc,
    receiverName,
    // Pago
    paymentType = 1,
    paymentDeadline,
    paymentTerms,
    paymentMethods = [],
    // Fechas
    issuedAt,
    // Totales
    subtotal,
    itbis,
    total,
    // Líneas
    lines,
    // Totales por tasa
    itbis1Base,
    itbis1Amount,
    itbis2Base,
    itbis2Amount,
    itbis3Base,
    exemptAmount
  } = invoiceData;

  const esc = escapeXMLSpecialChars;

  // ------------------------------------------------------------
  // Validación de comprador
  // ------------------------------------------------------------
  if (requireReceiver) {
    if (!receiverRnc) {
      throw new Error(`RNC Comprador is required for e-CF type ${type}`);
    }
    if (!receiverName) {
      throw new Error(`Razón Social Comprador is required for e-CF type ${type}`);
    }
  }

  // ------------------------------------------------------------
  // Calcular totales de tasas
  // ------------------------------------------------------------
  const base18 = Number(itbis1Base || subtotal || 0);
  const amount18 = Number(itbis1Amount || itbis || 0);
  const base16 = Number(itbis2Base || 0);
  const amount16 = Number(itbis2Amount || 0);
  const base0 = Number(itbis3Base || 0);
  const exempt = Number(exemptAmount || 0);

  const montoGravadoTotal = base18 + base16 + base0;
  const totalITBIS = amount18 + amount16;

  // ------------------------------------------------------------
  // 1. ENCABEZADO
  // ------------------------------------------------------------
  const encabezado = `
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>${type}</TipoeCF>
      <eNCF>${esc(ncf)}</eNCF>
      <FechaVencimientoSecuencia>${fmtDate(sequenceExpiresAt)}</FechaVencimientoSecuencia>
      <IndicadorMontoGravado>0</IndicadorMontoGravado>
      <TipoIngresos>01</TipoIngresos>
      <TipoPago>${paymentType}</TipoPago>
      ${paymentType === 2 && paymentDeadline ? `<FechaLimitePago>${fmtDate(paymentDeadline)}</FechaLimitePago>` : ''}
      ${paymentType === 2 && paymentTerms ? `<TerminoPago>${esc(paymentTerms)}</TerminoPago>` : ''}
      ${paymentMethods.length > 0 ? `
      <TablaFormasPago>
        ${paymentMethods.map(pm => `
        <FormaDePago>
          <FormaPago>${pm.method}</FormaPago>
          <MontoPago>${fmtMoney(pm.amount)}</MontoPago>
        </FormaDePago>`).join('')}
      </TablaFormasPago>` : ''}
    </IdDoc>
    <Emisor>
      <RNCEmisor>${esc(issuerRnc)}</RNCEmisor>
      <RazonSocialEmisor>${esc(issuerName)}</RazonSocialEmisor>
      ${issuerTradeName ? `<NombreComercial>${esc(issuerTradeName)}</NombreComercial>` : ''}
      <DireccionEmisor>${esc(issuerAddress)}</DireccionEmisor>
      ${issuerMunicipio ? `<Municipio>${esc(issuerMunicipio)}</Municipio>` : ''}
      ${issuerProvincia ? `<Provincia>${esc(issuerProvincia)}</Provincia>` : ''}
      ${issuerPhone ? `
      <TablaTelefonoEmisor>
        <TelefonoEmisor>${esc(issuerPhone)}</TelefonoEmisor>
      </TablaTelefonoEmisor>` : ''}
      ${issuerEmail ? `<CorreoEmisor>${esc(issuerEmail)}</CorreoEmisor>` : ''}
      ${issuerWebsite ? `<WebSite>${esc(issuerWebsite)}</WebSite>` : ''}
      ${issuerEconomicActivity ? `<ActividadEconomica>${esc(issuerEconomicActivity)}</ActividadEconomica>` : ''}
      <FechaEmision>${fmtDate(issuedAt)}</FechaEmision>
    </Emisor>
    ${(receiverRnc || receiverName) ? `
    <Comprador>
      ${receiverRnc ? `<RNCComprador>${esc(receiverRnc)}</RNCComprador>` : ''}
      ${receiverName ? `<RazonSocialComprador>${esc(receiverName)}</RazonSocialComprador>` : ''}
    </Comprador>` : ''}
    <Totales>
      <MontoGravadoTotal>${fmtMoney(montoGravadoTotal)}</MontoGravadoTotal>
      <MontoGravadoI1>${fmtMoney(base18)}</MontoGravadoI1>
      ${base16 > 0 ? `<MontoGravadoI2>${fmtMoney(base16)}</MontoGravadoI2>` : ''}
      ${base0 > 0 ? `<MontoGravadoI3>${fmtMoney(base0)}</MontoGravadoI3>` : ''}
      ${exempt > 0 ? `<MontoExento>${fmtMoney(exempt)}</MontoExento>` : ''}
      <ITBIS1>18</ITBIS1>
      ${base16 > 0 ? `<ITBIS2>16</ITBIS2>` : ''}
      ${base0 > 0 ? `<ITBIS3>0</ITBIS3>` : ''}
      <TotalITBIS>${fmtMoney(totalITBIS)}</TotalITBIS>
      ${amount18 > 0 ? `<TotalITBIS1>${fmtMoney(amount18)}</TotalITBIS1>` : ''}
      ${amount16 > 0 ? `<TotalITBIS2>${fmtMoney(amount16)}</TotalITBIS2>` : ''}
      <MontoTotal>${fmtMoney(total)}</MontoTotal>
    </Totales>
  </Encabezado>`;

  // ------------------------------------------------------------
  // 2. DETALLE DE ITEMS
  // ------------------------------------------------------------
  const detallesItems = `
  <DetallesItems>
    ${lines.map((line, index) => {
    const lineNumber = line.lineNumber || (index + 1);
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const discount = Number(line.discount || 0);
    const itbisRate = line.itbisRate;
    const montoItem = (quantity * unitPrice) - discount;
    const indicadorFacturacion = getIndicadorFacturacion(itbisRate);

    return `
    <Item>
      <NumeroLinea>${lineNumber}</NumeroLinea>
      <IndicadorFacturacion>${indicadorFacturacion}</IndicadorFacturacion>
      ${line.itemCode ? `
      <TablaCodigosItem>
        <CodigosItem>
          <TipoCodigo>Interna</TipoCodigo>
          <CodigoItem>${esc(line.itemCode)}</CodigoItem>
        </CodigosItem>
      </TablaCodigosItem>` : ''}
      <NombreItem>${esc(line.description)}</NombreItem>
      <IndicadorBienoServicio>2</IndicadorBienoServicio>
      <CantidadItem>${fmtQuantity(quantity)}</CantidadItem>
      <UnidadMedida>43</UnidadMedida>
      <PrecioUnitarioItem>${fmtMoney(unitPrice)}</PrecioUnitarioItem>
      ${discount > 0 ? `<DescuentoMonto>${fmtMoney(discount)}</DescuentoMonto>` : ''}
      <MontoItem>${fmtMoney(montoItem)}</MontoItem>
    </Item>`;
  }).join('')}
  </DetallesItems>`;

  // ------------------------------------------------------------
  // 3. FECHA Y HORA DE FIRMA (placeholder)
  // ------------------------------------------------------------
  const fechaHoraFirma = `
  <FechaHoraFirma>${fmtDateTime(new Date())}</FechaHoraFirma>`;

  // ------------------------------------------------------------
  // 4. ARMAR XML
  // ------------------------------------------------------------
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>${encabezado}${detallesItems}${fechaHoraFirma}
</ECF>`;

  // ------------------------------------------------------------
  // 5. LIMPIAR TAGS VACÍOS
  // ------------------------------------------------------------
  xml = removeEmptyTags(xml);

  return xml;
}

// ============================================================
// 4. GENERADORES POR TIPO (wrappers ligeros)
// ============================================================

// ------------------------------------------------------------
// Genera XML para e-CF 32 (Factura de Consumo)
// ------------------------------------------------------------
function generateECF32(invoiceData) {
  return buildECFBody(invoiceData, {
    type: '32',
    requireReceiver: false // RNC comprador opcional en FC < 250K
  });
}

// ------------------------------------------------------------
// Genera XML para e-CF 31 (Factura de Crédito Fiscal)
// ------------------------------------------------------------
function generateECF31(invoiceData) {
  return buildECFBody(invoiceData, {
    type: '31',
    requireReceiver: true // RNC + Razón Social obligatorios
  });
}


// ============================================================
// 5. GENERADOR DE RFCE (Resumen de Factura de Consumo)
// ============================================================

// ------------------------------------------------------------
// Genera el XML del Resumen de Factura de Consumo Electrónica
// Consolida todas las FC < DOP$250,000 de un período
// ------------------------------------------------------------
function buildRFCE(rfceData) {
  const {
    issuerRnc,
    issuerName,
    periodFrom,
    periodTo,
    issuedAt,
    invoices
  } = rfceData;

  const esc = escapeXMLSpecialChars;

  // ------------------------------------------------------------
  // Validaciones
  // ------------------------------------------------------------
  if (!invoices || invoices.length === 0) {
    throw new Error('RFCE requires at least one invoice');
  }

  // ------------------------------------------------------------
  // Calcular totales consolidados
  // ------------------------------------------------------------
  let totalMontoGravado = 0;
  let totalITBIS = 0;
  let totalMonto = 0;

  for (const inv of invoices) {
    const base18 = Number(inv.itbis1Base || 0);
    const base16 = Number(inv.itbis2Base || 0);
    const base0 = Number(inv.itbis3Base || 0);
    const amount18 = Number(inv.itbis1Amount || 0);
    const amount16 = Number(inv.itbis2Amount || 0);
    const invTotal = Number(inv.total || 0);

    totalMontoGravado += base18 + base16 + base0;
    totalITBIS += amount18 + amount16;
    totalMonto += invTotal;
  }

  // ------------------------------------------------------------
  // Construir XML
  // ------------------------------------------------------------
  const detalleECF = invoices.map(inv => {
    const base18 = Number(inv.itbis1Base || 0);
    const base16 = Number(inv.itbis2Base || 0);
    const base0 = Number(inv.itbis3Base || 0);
    const amount18 = Number(inv.itbis1Amount || 0);
    const amount16 = Number(inv.itbis2Amount || 0);

    const montoGravado = base18 + base16 + base0;
    const itbis = amount18 + amount16;

    return `
    <ECFResumen>
      <eNCF>${esc(inv.ncf)}</eNCF>
      <FechaEmision>${fmtDate(inv.issuedAt)}</FechaEmision>
      <MontoGravado>${fmtMoney(montoGravado)}</MontoGravado>
      <ITBIS>${fmtMoney(itbis)}</ITBIS>
      <MontoTotal>${fmtMoney(inv.total)}</MontoTotal>
    </ECFResumen>`;
  }).join('');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<RFCE>
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>32</TipoeCF>
      <RNCEmisor>${esc(issuerRnc)}</RNCEmisor>
      <RazonSocialEmisor>${esc(issuerName)}</RazonSocialEmisor>
      <PeriodoDesde>${fmtDate(periodFrom)}</PeriodoDesde>
      <PeriodoHasta>${fmtDate(periodTo)}</PeriodoHasta>
      <FechaEmision>${fmtDate(issuedAt)}</FechaEmision>
      <TotalMontoGravado>${fmtMoney(totalMontoGravado)}</TotalMontoGravado>
      <TotalITBIS>${fmtMoney(totalITBIS)}</TotalITBIS>
      <TotalMonto>${fmtMoney(totalMonto)}</TotalMonto>
      <CantidadECF>${invoices.length}</CantidadECF>
    </IdDoc>
  </Encabezado>
  <DetalleECF>${detalleECF}
  </DetalleECF>
  <FechaHoraFirma>${fmtDateTime(new Date())}</FechaHoraFirma>
</RFCE>`;

  xml = removeEmptyTags(xml);
  return xml;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  escapeXMLSpecialChars,
  removeEmptyTags,
  buildQRCodeData,
  extractSecurityCode,
  generateECF32,
  generateECF31,
  buildRFCE
};