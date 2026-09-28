// ============================================================
// Generador de XML para e-CF (Comprobantes Fiscales Electrónicos)
// Este módulo es invocado por invoices.service.js
// NO es un módulo HTTP. NO tiene rutas ni controladores.
// ============================================================

// ============================================================
// HELPERS INTERNOS DEL MÓDULO
// ============================================================

// ------------------------------------------------------------
// Formatea una fecha a dd-MM-yyyy
// Usa UTC para consistencia entre zonas horarias
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
// Formatea una fecha+hora a dd-MM-yyyy HH:mm:ss
// Usa UTC para consistencia entre zonas horarias
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


// ============================================================
// 1. UTILIDADES DE ESCAPADO Y LIMPIEZA XML
// ============================================================

// ------------------------------------------------------------
// Escapa caracteres especiales en texto para que sea seguro en XML
// Requisito: el texto del usuario puede contener &, <, >, ", '
// Si no se escapan, el XML queda inválido.
// ------------------------------------------------------------
function escapeXMLSpecialChars(text) {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);

  return str
    .replace(/&/g, '&amp;')   // PRIMERO, porque las demás entidades usan &
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ------------------------------------------------------------
// Elimina tags vacíos del XML
// Requisito DGII: el XML NO puede contener tags vacíos
//   <tag></tag>  → se elimina
//   <tag/>       → se elimina
//   <tag>   </tag> → se elimina (solo espacios en blanco)
// ------------------------------------------------------------
function removeEmptyTags(xml) {
  if (!xml || typeof xml !== 'string') {
    return xml;
  }

  // Iterar hasta que no haya cambios (porque eliminar un tag puede
  // dejar el padre vacío y hay que eliminarlo también)
  let previousXml;
  let currentXml = xml;

  do {
    previousXml = currentXml;

    // Elimina <tag></tag> y <tag>   </tag> (con espacios)
    currentXml = currentXml.replace(
      /<([a-zA-Z0-9_:]+)(\s[^>]*)?>\s*<\/\1>/g,
      ''
    );

    // Elimina <tag/> (self-closing)
    currentXml = currentXml.replace(
      /<([a-zA-Z0-9_:]+)(\s[^>]*)?\/>/g,
      ''
    );

  } while (currentXml !== previousXml);

  return currentXml;
}

// ============================================================
// 2. CONSTRUCCIÓN DEL CÓDIGO QR PARA LA REPRESENTACIÓN IMPRESA
// ============================================================

// ------------------------------------------------------------
// Construye la URL del código QR según especificaciones de DGII
//
// Para e-CF normales (31, 32, 33, 34, etc.):
//   https://ecf.dgii.gov.do/ecf/ConsultaTimbre?...
//
// Para Factura de Consumo < DOP$250,000 (tipo 32):
//   https://fc.dgii.gov.do/ecF/ConsultaTimbreFC?...
//
// IMPORTANTE: el CodigoSeguridad viene en Base64 y puede contener
// caracteres especiales como + y /. Hay que codificarlos con
// encodeURIComponent() para que no se interpreten mal.
// ------------------------------------------------------------
function buildQRCodeData(invoiceData) {
  const {
    issuerRnc,
    ncf,
    receiverRnc,
    total,
    issuedAt,
    type,
    signedAt,           // Fecha de firma (cuando se firmó el XML)
    securityCode        // Primeros 6 chars del SignatureValue
  } = invoiceData;

  // ------------------------------------------------------------
  // 1. Formatear fechas
  // ------------------------------------------------------------


  // ------------------------------------------------------------
  // 2. Determinar si es Factura de Consumo < DOP$250,000
  //    (usa URL de FC, no de e-CF normal)
  // ------------------------------------------------------------
  const totalNumber = Number(total) || 0;
  const isFC = type === '32' && totalNumber < 250000;

  // ------------------------------------------------------------
  // 3. Formatear monto (siempre con 2 decimales)
  // ------------------------------------------------------------
  const formattedTotal = totalNumber.toFixed(2);

  // ------------------------------------------------------------
  // 4. Construir la URL según el tipo
  // ------------------------------------------------------------
  if (isFC) {
    // Factura de Consumo < DOP$250,000
    // Parámetros: RncEmisor, ENCF, MontoTotal, CodigoSeguridad
    const params = [
      `RncEmisor=${encodeURIComponent(issuerRnc)}`,
      `ENCF=${encodeURIComponent(ncf)}`,
      `MontoTotal=${encodeURIComponent(formattedTotal)}`,
      `CodigoSeguridad=${encodeURIComponent(securityCode || '')}`
    ].join('&');

    return `https://fc.dgii.gov.do/ecf/ConsultaTimbreFC?${params}`;
  }

  // e-CF normal (31, 32 > 250K, 33, 34, 41, 43, 44, 45, 46, 47)
  // Parámetros: RncEmisor, RncComprador, ENCF, FechaEmision, MontoTotal, FechaFirma, CodigoSeguridad
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

// ------------------------------------------------------------
// Extrae los primeros 6 caracteres del SignatureValue
// El SignatureValue viene en Base64 dentro del XML firmado.
// Se usa como CodigoSeguridad en el QR.
// ------------------------------------------------------------
function extractSecurityCode(signatureValue) {
  if (!signatureValue || typeof signatureValue !== 'string') {
    return '';
  }
  return signatureValue.substring(0, 6);
}

// ============================================================
// 3. GENERADOR DE XML PARA e-CF 32 (Factura de Consumo)
// ============================================================

// ------------------------------------------------------------
// Genera el XML completo para un e-CF tipo 32
// NO firma. Solo construye la estructura.
// La firma se agrega en el Step 12 (módulo dgii).
// ------------------------------------------------------------
function generateECF32(invoiceData) {
  const {
    // IdDoc
    ncf,
    sequenceExpiresAt,      // Fecha de vencimiento de la secuencia
    // Emisor
    issuerRnc,
    issuerName,
    issuerTradeName,        // Opcional
    issuerAddress,
    issuerMunicipio,        // Código de la Tabla III
    issuerProvincia,        // Código de la Tabla III
    issuerPhone,            // Opcional
    issuerEmail,            // Opcional
    issuerWebsite,          // Opcional
    issuerEconomicActivity, // Opcional
    // Comprador
    receiverRnc,
    receiverName,
    // Pago
    paymentType = 1,        // 1: Contado, 2: Crédito, 3: Gratuito
    paymentDeadline,        // Solo si paymentType = 2
    paymentTerms,           // Texto libre: "30 días", "1 semana"
    paymentMethods = [],    // [{ method: 1, amount: 1180.00 }]
    // Fechas
    issuedAt,
    // Totales
    subtotal,               // Base gravada 18%
    itbis,                  // ITBIS total
    total,
    // Líneas
    lines,                  // Array de items
    // Totales por tasa
    itbis1Base,             // Base ITBIS 18%
    itbis1Amount,           // ITBIS 18% monto
    itbis2Base,             // Base ITBIS 16% (opcional)
    itbis2Amount,           // ITBIS 16% monto (opcional)
    itbis3Base,             // Base ITBIS 0% (opcional)
    exemptAmount            // Monto exento (opcional)
  } = invoiceData;

  // ------------------------------------------------------------
  // Helpers locales
  // ------------------------------------------------------------
  const esc = escapeXMLSpecialChars;


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
      <TipoeCF>32</TipoeCF>
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
    const itbisRate = Number(line.itbisRate || 0);
    const montoItem = (quantity * unitPrice) - discount;

    // Indicador de facturación según ITBIS
    let indicadorFacturacion = 1;
    if (itbisRate === 18) indicadorFacturacion = 1;
    else if (itbisRate === 16) indicadorFacturacion = 2;
    else if (itbisRate === 0) indicadorFacturacion = 3;
    else if (itbisRate === null || itbisRate === undefined) indicadorFacturacion = 4;
    // Si el usuario marca "exento" → 4

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
  // 3. FECHA Y HORA DE FIRMA (se completa en el Step 12)
  // ------------------------------------------------------------
  // La dejamos como placeholder para que el firmador la reemplace
  const fechaHoraFirma = `
  <FechaHoraFirma>${fmtDate(new Date())} ${new Date().toTimeString().substring(0, 8)}</FechaHoraFirma>`;

  // ------------------------------------------------------------
  // 4. ARMAR EL XML COMPLETO
  // ------------------------------------------------------------
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>${encabezado}${detallesItems}${fechaHoraFirma}
</ECF>`;

  // ------------------------------------------------------------
  // 5. LIMPIAR TAGS VACÍOS (requisito DGII)
  // ------------------------------------------------------------
  xml = removeEmptyTags(xml);

  return xml;
}

module.exports = {
  escapeXMLSpecialChars,
  removeEmptyTags,
  buildQRCodeData,
  extractSecurityCode,
  generateECF32
};