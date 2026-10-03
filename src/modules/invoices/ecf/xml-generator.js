// ============================================================
// LIBRERÍAS
// ============================================================
const fs = require('fs');
const path = require('path');
const libxml = require('libxmljs2');
const { getTypeProfile } = require('./type-profiles');

// ============================================================
// HELPERS INTERNOS DEL MÓDULO (no se exportan)
// ============================================================

function fmtDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
}

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

function fmtMoney(num) {
    return Number(num || 0).toFixed(2);
}

function fmtQuantity(num) {
    return Number(num || 0).toFixed(2);
}

function getIndicadorFacturacion(itbisRate) {
    if (itbisRate === null || itbisRate === undefined) return 4;
    const rate = Number(itbisRate);
    if (rate === 18) return 1;
    if (rate === 16) return 2;
    if (rate === 0) return 3;
    return 4;
}

// ============================================================
// 1. UTILIDADES DE ESCAPADO Y LIMPIEZA XML
// ============================================================

function escapeXMLSpecialChars(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ------------------------------------------------------------
// Elimina tags vacíos del XML (requisito DGII).
// EXCEPCIÓN: preserva <Comprador> aunque esté vacío porque el XSD
// lo exige como contenedor obligatorio (minOccurs="1").
// ------------------------------------------------------------
function removeEmptyTags(xml) {
    if (!xml || typeof xml !== 'string') return xml;

    const PRESERVE_EMPTY = ['Comprador'];
    const preservePattern = PRESERVE_EMPTY.join('|');

    const emptyTagRegex = new RegExp(
        `<(?!(?:${preservePattern})\\b)([a-zA-Z0-9_:]+)(\\s[^>]*)?>\\s*<\\/\\1>`,
        'g'
    );
    const selfClosingRegex = new RegExp(
        `<(?!(?:${preservePattern})\\b)([a-zA-Z0-9_:]+)(\\s[^>]*)?\\/>`,
        'g'
    );

    let previousXml;
    let currentXml = xml;
    do {
        previousXml = currentXml;
        currentXml = currentXml.replace(emptyTagRegex, '');
        currentXml = currentXml.replace(selfClosingRegex, '');
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
    if (!signatureValue || typeof signatureValue !== 'string') return '';
    return signatureValue.substring(0, 6);
}


// ============================================================
// 3. CONSTRUCTOR BASE — perfil-driven
// ============================================================
const esc = escapeXMLSpecialChars;

/**
 * Validaciones específicas por tipo, guiadas por el perfil.
 */
function validateForType(invoiceData, profile) {
    const { code } = profile;
    const {
        receiverRnc, receiverName,
        modifiedNcf, modifiedNcfDate, modificationCode,
        indicadorNotaCredito,
    } = invoiceData;

    // Comprador obligatorio (definido por perfil)
    if (profile.comprador.present && profile.comprador.rncRequired && !receiverRnc) {
        throw new Error(`RNC Comprador is required for e-CF type ${code}`);
    }
    if (profile.comprador.present && profile.comprador.razonSocialRequired && !receiverName) {
        throw new Error(`Razón Social Comprador is required for e-CF type ${code}`);
    }

    // Notas 33/34
    if (profile.taxRules.isNota) {
        if (!modifiedNcf) throw new Error(`NCFModificado is required for e-CF type ${code}`);
        if (!modifiedNcfDate) throw new Error(`FechaNCFModificado is required for e-CF type ${code}`);
        if (!modificationCode) throw new Error(`CodigoModificacion is required for e-CF type ${code}`);
    }

    // 34: IndicadorNotaCredito
    if (profile.idDoc.hasIndicadorNotaCredito) {
        if (indicadorNotaCredito === null || indicadorNotaCredito === undefined) {
            throw new Error(`IndicadorNotaCredito is required for e-CF type ${code} (0 or 1)`);
        }
        const inc = Number(indicadorNotaCredito);
        if (inc !== 0 && inc !== 1) {
            throw new Error(`IndicadorNotaCredito must be 0 or 1 for e-CF type ${code}`);
        }
    }
}

/**
 * Cálculo de totales en base a las líneas + datos del invoice.
 */
function computeTotals(invoiceData) {
    const {
        subtotal, itbis, total, lines = [],
        itbis1Base, itbis1Amount,
        itbis2Base, itbis2Amount,
        itbis3Base, exemptAmount,
    } = invoiceData;

    const base18 = Number(itbis1Base || subtotal || 0);
    const amount18 = Number(itbis1Amount || itbis || 0);
    const base16 = Number(itbis2Base || 0);
    const amount16 = Number(itbis2Amount || 0);
    const base0 = Number(itbis3Base || 0);
    const exempt = Number(exemptAmount || 0);

    const montoGravadoTotal = base18 + base16 + base0;
    const totalITBIS = amount18 + amount16;

    return {
        base18, amount18,
        base16, amount16,
        base0, exempt,
        montoGravadoTotal, totalITBIS,
        total: Number(total || 0),
        lines,
    };
}

// ------------------------------------------------------------
// BLOQUES INTERNOS
// ------------------------------------------------------------

function buildIdDoc(invoiceData, profile) {
    const {
        ncf, sequenceExpiresAt, paymentType = 1,
        paymentDeadline, paymentTerms, paymentMethods = [],
        indicadorNotaCredito,
    } = invoiceData;

    const fechaVencimientoSecuencia = profile.idDoc.hasFechaVencimientoSecuencia && sequenceExpiresAt
        ? `<FechaVencimientoSecuencia>${fmtDate(sequenceExpiresAt)}</FechaVencimientoSecuencia>`
        : '';

    const indicadorNotaCreditoXml = profile.idDoc.hasIndicadorNotaCredito
        ? `<IndicadorNotaCredito>${Number(indicadorNotaCredito)}</IndicadorNotaCredito>`
        : '';

    // Bloque de formas de pago — solo si el XSD del tipo lo permite
    let paymentBlocks = '';
    if (profile.idDoc.hasTablaFormasPago) {
        paymentBlocks = `
      ${paymentType === 2 && paymentDeadline ? `<FechaLimitePago>${fmtDate(paymentDeadline)}</FechaLimitePago>` : ''}
      ${paymentType === 2 && paymentTerms ? `<TerminoPago>${esc(paymentTerms)}</TerminoPago>` : ''}
      ${paymentMethods.length > 0 ? `
      <TablaFormasPago>
        ${paymentMethods.map(pm => `
        <FormaDePago>
          <FormaPago>${pm.method}</FormaPago>
          <MontoPago>${fmtMoney(pm.amount)}</MontoPago>
        </FormaDePago>`).join('')}
      </TablaFormasPago>` : ''}`;
    } else {
        paymentBlocks = `
      ${paymentType === 2 && paymentDeadline ? `<FechaLimitePago>${fmtDate(paymentDeadline)}</FechaLimitePago>` : ''}`;
    }

    const indicadorMontoGravado = profile.idDoc.hasIndicadorMontoGravado
        ? `<IndicadorMontoGravado>0</IndicadorMontoGravado>`
        : '';

    const tipoIngresos = profile.idDoc.hasTipoIngresos
        ? `<TipoIngresos>01</TipoIngresos>`
        : '';

    return `
    <IdDoc>
      <TipoeCF>${profile.code}</TipoeCF>
      <eNCF>${esc(ncf)}</eNCF>
      ${indicadorNotaCreditoXml}
      ${fechaVencimientoSecuencia}
      ${indicadorMontoGravado}
      ${tipoIngresos}
      <TipoPago>${paymentType}</TipoPago>
      ${paymentBlocks}
    </IdDoc>`;
}

function buildEmisor(invoiceData, profile) {
    const {
        issuerRnc, issuerName, issuerTradeName,
        issuerAddress, issuerMunicipio, issuerProvincia,
        issuerPhone, issuerEmail, issuerWebsite,
        issuerEconomicActivity, issuedAt,
    } = invoiceData;

    return `
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
    </Emisor>`;
}

function buildComprador(invoiceData, profile) {
    if (!profile.comprador.present) return '';

    const { receiverRnc, receiverName, receiverIdentificadorExtranjero } = invoiceData;

    return `
    <Comprador>
      ${receiverRnc ? `<RNCComprador>${esc(receiverRnc)}</RNCComprador>` : ''}
      ${profile.comprador.hasIdentificadorExtranjero && receiverIdentificadorExtranjero
            ? `<IdentificadorExtranjero>${esc(receiverIdentificadorExtranjero)}</IdentificadorExtranjero>` : ''}
      ${receiverName ? `<RazonSocialComprador>${esc(receiverName)}</RazonSocialComprador>` : ''}
    </Comprador>`;
}

function buildTransporte(invoiceData, profile) {
    if (!profile.hasTransporteBlock) return '';

    const t = invoiceData.transporte || {};

    if (profile.transporte.extended) {
        // 46 — extendido
        return `
    <Transporte>
      ${t.viaTransporte ? `<ViaTransporte>${esc(t.viaTransporte)}</ViaTransporte>` : ''}
      ${t.paisOrigen ? `<PaisOrigen>${esc(t.paisOrigen)}</PaisOrigen>` : ''}
      ${t.direccionDestino ? `<DireccionDestino>${esc(t.direccionDestino)}</DireccionDestino>` : ''}
      ${t.paisDestino ? `<PaisDestino>${esc(t.paisDestino)}</PaisDestino>` : ''}
      ${t.rncCompaniaTransportista ? `<RNCIdentificacionCompaniaTransportista>${esc(t.rncCompaniaTransportista)}</RNCIdentificacionCompaniaTransportista>` : ''}
      ${t.nombreCompaniaTransportista ? `<NombreCompaniaTransportista>${esc(t.nombreCompaniaTransportista)}</NombreCompaniaTransportista>` : ''}
      ${t.numeroViaje ? `<NumeroViaje>${esc(t.numeroViaje)}</NumeroViaje>` : ''}
      ${t.conductor ? `<Conductor>${esc(t.conductor)}</Conductor>` : ''}
      ${t.documentoTransporte ? `<DocumentoTransporte>${esc(t.documentoTransporte)}</DocumentoTransporte>` : ''}
      ${t.ficha ? `<Ficha>${esc(t.ficha)}</Ficha>` : ''}
      ${t.placa ? `<Placa>${esc(t.placa)}</Placa>` : ''}
      ${t.rutaTransporte ? `<RutaTransporte>${esc(t.rutaTransporte)}</RutaTransporte>` : ''}
      ${t.zonaTransporte ? `<ZonaTransporte>${esc(t.zonaTransporte)}</ZonaTransporte>` : ''}
      ${t.numeroAlbaran ? `<NumeroAlbaran>${esc(t.numeroAlbaran)}</NumeroAlbaran>` : ''}
    </Transporte>`;
    }

    if (profile.transporte.reduced) {
        // 47 — reducido
        return `
    <Transporte>
      ${t.paisDestino ? `<PaisDestino>${esc(t.paisDestino)}</PaisDestino>` : ''}
    </Transporte>`;
    }

    // full (31/32/33/34/44/45)
    return `
    <Transporte>
      ${t.conductor ? `<Conductor>${esc(t.conductor)}</Conductor>` : ''}
      ${t.documentoTransporte ? `<DocumentoTransporte>${esc(t.documentoTransporte)}</DocumentoTransporte>` : ''}
      ${t.ficha ? `<Ficha>${esc(t.ficha)}</Ficha>` : ''}
      ${t.placa ? `<Placa>${esc(t.placa)}</Placa>` : ''}
      ${t.rutaTransporte ? `<RutaTransporte>${esc(t.rutaTransporte)}</RutaTransporte>` : ''}
      ${t.zonaTransporte ? `<ZonaTransporte>${esc(t.zonaTransporte)}</ZonaTransporte>` : ''}
      ${t.numeroAlbaran ? `<NumeroAlbaran>${esc(t.numeroAlbaran)}</NumeroAlbaran>` : ''}
    </Transporte>`;
}

function buildTotales(computed, profile) {
    const { base18, amount18, base16, amount16, base0, exempt,
        montoGravadoTotal, totalITBIS, total } = computed;

    // Variante "exento-only" (43/44/47)
    if (!profile.totales.hasMontoGravadoTotal && profile.totales.hasMontoExento) {
        return `
    <Totales>
      ${exempt > 0 ? `<MontoExento>${fmtMoney(exempt)}</MontoExento>` : ''}
      <MontoTotal>${fmtMoney(total)}</MontoTotal>
    </Totales>`;
    }

    // Variante "ITBIS3-only" (46)
    if (!profile.totales.hasITBIS1 && profile.totales.hasITBIS3) {
        return `
    <Totales>
      <MontoGravadoTotal>${fmtMoney(montoGravadoTotal)}</MontoGravadoTotal>
      <MontoGravadoI3>${fmtMoney(base0 || base18)}</MontoGravadoI3>
      <ITBIS3>0</ITBIS3>
      <TotalITBIS>${fmtMoney(totalITBIS)}</TotalITBIS>
      <TotalITBIS3>${fmtMoney(totalITBIS)}</TotalITBIS3>
      <MontoTotal>${fmtMoney(total)}</MontoTotal>
    </Totales>`;
    }

    // Variante full (31/32/33/34/41/45)
    return `
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
    </Totales>`;
}

function buildItems(computed, profile) {
    const { lines } = computed;

    return `
  <DetallesItems>
    ${lines.map((line, index) => {
        const lineNumber = line.lineNumber || (index + 1);
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const itbisRate = line.itbisRate;
        const montoItem = (quantity * unitPrice) - discount;
        const indicadorFacturacion = getIndicadorFacturacion(itbisRate);

        // Retención obligatoria (41 y 47)
        const retencionBlock = (profile.items.hasRetencion && profile.items.retencionRequired && line.retencion)
            ? `
      <Retencion>
        <IndicadorAgenteRetencionoPercepcion>${line.retencion.indicador}</IndicadorAgenteRetencionoPercepcion>
        ${line.retencion.montoItbisRetenido ? `<MontoITBISRetenido>${fmtMoney(line.retencion.montoItbisRetenido)}</MontoITBISRetenido>` : ''}
        ${line.retencion.montoIsrRetenido ? `<MontoISRRetenido>${fmtMoney(line.retencion.montoIsrRetenido)}</MontoISRRetenido>` : ''}
      </Retencion>` : '';

        const descuentoBlock = (profile.items.hasDescuento && discount > 0)
            ? `<DescuentoMonto>${fmtMoney(discount)}</DescuentoMonto>`
            : '';

        return `
     <Item>
      <NumeroLinea>${lineNumber}</NumeroLinea>
      ${line.itemCode && profile.items.hasTablaCodigosItem ? `
      <TablaCodigosItem>
        <CodigosItem>
          <TipoCodigo>Interna</TipoCodigo>
          <CodigoItem>${esc(line.itemCode)}</CodigoItem>
        </CodigosItem>
      </TablaCodigosItem>` : ''}
      <IndicadorFacturacion>${indicadorFacturacion}</IndicadorFacturacion>
      ${retencionBlock}
      <NombreItem>${esc(line.description)}</NombreItem>
      <IndicadorBienoServicio>2</IndicadorBienoServicio>
      <CantidadItem>${fmtQuantity(quantity)}</CantidadItem>
      <UnidadMedida>43</UnidadMedida>
      <PrecioUnitarioItem>${fmtMoney(unitPrice)}</PrecioUnitarioItem>
      ${descuentoBlock}
      <MontoItem>${fmtMoney(montoItem)}</MontoItem>
    </Item>`;
    }).join('')}
  </DetallesItems>`;
}

function buildInformacionReferencia(invoiceData, profile) {
    if (!profile.informacionReferencia.present) return '';
    if (!profile.informacionReferencia.required && !invoiceData.modifiedNcf) return '';

    const {
        modifiedNcf, modifiedNcfIssuerRnc, modifiedNcfDate,
        modificationCode, modificationReason,
    } = invoiceData;

    if (!modifiedNcf) return '';

    return `
  <InformacionReferencia>
    <NCFModificado>${esc(modifiedNcf)}</NCFModificado>
    ${modifiedNcfIssuerRnc ? `<RNCOtroContribuyente>${esc(modifiedNcfIssuerRnc)}</RNCOtroContribuyente>` : ''}
    <FechaNCFModificado>${fmtDate(modifiedNcfDate)}</FechaNCFModificado>
    <CodigoModificacion>${modificationCode}</CodigoModificacion>
    ${modificationReason ? `<RazonModificacion>${esc(modificationReason)}</RazonModificacion>` : ''}
  </InformacionReferencia>`;
}

// ------------------------------------------------------------
// ORQUESTADOR
// ------------------------------------------------------------

function buildECFBody(invoiceData, options) {
    const type = String(options.type);
    const profile = getTypeProfile(type);

    // 1. Validaciones
    validateForType(invoiceData, profile);

    // 2. Totales
    const computed = computeTotals(invoiceData);

    // 3. Bloques
    const encabezado = `
  <Encabezado>
    <Version>1.0</Version>
    ${buildIdDoc(invoiceData, profile)}
    ${buildEmisor(invoiceData, profile)}
    ${buildComprador(invoiceData, profile)}
    ${buildTransporte(invoiceData, profile)}
    ${buildTotales(computed, profile)}
  </Encabezado>`;

    const detallesItems = buildItems(computed, profile);
    const informacionReferencia = buildInformacionReferencia(invoiceData, profile);
    const fechaHoraFirma = `
  <FechaHoraFirma>${fmtDateTime(new Date())}</FechaHoraFirma>`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>${encabezado}${detallesItems}${informacionReferencia}${fechaHoraFirma}
</ECF>`;

    return removeEmptyTags(xml);
}

// ============================================================
// 4. GENERADORES POR TIPO
// ============================================================

function generateECF31(invoiceData) { return buildECFBody(invoiceData, { type: '31' }); }
function generateECF32(invoiceData) { return buildECFBody(invoiceData, { type: '32' }); }
function generateECF33(invoiceData) { return buildECFBody(invoiceData, { type: '33' }); }
function generateECF34(invoiceData) { return buildECFBody(invoiceData, { type: '34' }); }
function generateECF41(invoiceData) { return buildECFBody(invoiceData, { type: '41' }); }
function generateECF43(invoiceData) { return buildECFBody(invoiceData, { type: '43' }); }
function generateECF44(invoiceData) { return buildECFBody(invoiceData, { type: '44' }); }
function generateECF45(invoiceData) { return buildECFBody(invoiceData, { type: '45' }); }
function generateECF46(invoiceData) { return buildECFBody(invoiceData, { type: '46' }); }
function generateECF47(invoiceData) { return buildECFBody(invoiceData, { type: '47' }); }


// ============================================================
// 5. GENERADOR DE RFCE (Resumen de Factura de Consumo < 250K)
// ============================================================
// Estructura según:
//   - RFCE 32 v.1.0.xsd (DGII)
//   - Formato de Resumen Factura de Consumo Electrónica v1.0 (DGII)
//
// IMPORTANTE:
//   - Recibe los datos de UNA SOLA factura tipo 32 (monto < 250K).
//   - NO es un resumen consolidado de varias facturas.
//   - El XML resultante debe validar contra el XSD oficial.
// ============================================================

/**
 * Construye el XML del RFCE (Resumen de Factura de Consumo Electrónica < 250K)
 * a partir de los datos de UNA factura tipo 32.
 *
 * @param {object} invoiceData - datos de UNA factura tipo 32 (< 250K)
 * @param {string} codigoSeguridad - 6 primeros chars del hash de la firma del e-CF 32
 * @returns {string} XML del RFCE listo para firmar y enviar
 */
function buildRFCE(invoiceData, codigoSeguridad) {
    const {
        // IdDoc
        ncf,
        tipoIngresos = '01',
        tipoPago = 1,
        paymentMethods = [],   // [{ method: 1..8, amount: number }, ...] (máx 7)

        // Emisor
        issuerRnc,
        issuerName,
        issuedAt,

        // Comprador (todos opcionales según XSD)
        receiverRnc,
        receiverIdentificadorExtranjero,
        receiverName,

        // Totales (todos opcionales excepto MontoTotal)
        itbis1Base, itbis1Amount,
        itbis2Base, itbis2Amount,
        itbis3Base,
        exemptAmount,
        additionalTaxesAmount,   // MontoImpuestoAdicional (opcional, > 0)
        additionalTaxes = [],    // [{ code, iscEspecifico, iscAdvalorem, otros }] (máx 20)
        total,
        montoNoFacturable,
        montoPeriodo,
    } = invoiceData;

    // --- Validaciones mínimas alineadas al XSD ---
    if (!codigoSeguridad || String(codigoSeguridad).length !== 6) {
        throw new Error('RFCE: codigoSeguridad must be exactly 6 characters');
    }
    if (!ncf || String(ncf).length !== 13) {
        throw new Error('RFCE: eNCF must be exactly 13 characters');
    }
    if (!issuerRnc) {
        throw new Error('RFCE: issuerRnc is required');
    }
    if (!issuerName) {
        throw new Error('RFCE: issuerName is required');
    }
    if (total === undefined || total === null) {
        throw new Error('RFCE: total (MontoTotal) is required');
    }

    // --- Totales calculados ---
    const base18 = Number(itbis1Base || 0);
    const base16 = Number(itbis2Base || 0);
    const base0 = Number(itbis3Base || 0);
    const amount18 = Number(itbis1Amount || 0);
    const amount16 = Number(itbis2Amount || 0);
    const exempt = Number(exemptAmount || 0);

    const montoGravadoTotal = base18 + base16 + base0;
    const totalITBIS = amount18 + amount16;

    // --- TablaFormasPago (opcional, hasta 7) ---
    const tablaFormasPagoXml = paymentMethods.length > 0
        ? `
      <TablaFormasPago>
        ${paymentMethods.slice(0, 7).map(pm => `
        <FormaDePago>
          <FormaPago>${Number(pm.method)}</FormaPago>
          <MontoPago>${fmtMoney(pm.amount)}</MontoPago>
        </FormaDePago>`).join('')}
      </TablaFormasPago>`
        : '';

    // --- ImpuestosAdicionales (opcional, hasta 20) ---
    const impuestosAdicionalesXml = additionalTaxes.length > 0
        ? `
      <ImpuestosAdicionales>
        ${additionalTaxes.slice(0, 20).map(t => `
        <ImpuestoAdicional>
          <TipoImpuesto>${esc(String(t.code))}</TipoImpuesto>
          ${Number(t.iscEspecifico) > 0 ? `<MontoImpuestoSelectivoConsumoEspecifico>${fmtMoney(t.iscEspecifico)}</MontoImpuestoSelectivoConsumoEspecifico>` : ''}
          ${Number(t.iscAdvalorem) > 0 ? `<MontoImpuestoSelectivoConsumoAdvalorem>${fmtMoney(t.iscAdvalorem)}</MontoImpuestoSelectivoConsumoAdvalorem>` : ''}
          ${Number(t.otros) > 0 ? `<OtrosImpuestosAdicionales>${fmtMoney(t.otros)}</OtrosImpuestosAdicionales>` : ''}
        </ImpuestoAdicional>`).join('')}
      </ImpuestosAdicionales>`
        : '';

    // --- Comprador (bloque opcional pero el XSD lo exige como elemento) ---
    // El XSD declara <Comprador> sin minOccurs, por defecto es required,
    // pero todos sus hijos son opcionales. Por eso lo emitimos vacío si no hay datos.
    const compradorXml = `
    <Comprador>
      ${receiverRnc ? `<RNCComprador>${esc(receiverRnc)}</RNCComprador>` : ''}
      ${receiverIdentificadorExtranjero ? `<IdentificadorExtranjero>${esc(receiverIdentificadorExtranjero)}</IdentificadorExtranjero>` : ''}
      ${receiverName ? `<RazonSocialComprador>${esc(receiverName)}</RazonSocialComprador>` : ''}
    </Comprador>`;

    // --- XML final ---
    let xml = `<?xml version="1.0" encoding="utf-8"?>
<RFCE>
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>32</TipoeCF>
      <eNCF>${esc(ncf)}</eNCF>
      <TipoIngresos>${esc(String(tipoIngresos))}</TipoIngresos>
      <TipoPago>${Number(tipoPago)}</TipoPago>${tablaFormasPagoXml}
    </IdDoc>
    <Emisor>
      <RNCEmisor>${esc(issuerRnc)}</RNCEmisor>
      <RazonSocialEmisor>${esc(issuerName)}</RazonSocialEmisor>
      <FechaEmision>${fmtDate(issuedAt)}</FechaEmision>
    </Emisor>${compradorXml}
    <Totales>
      ${montoGravadoTotal > 0 ? `<MontoGravadoTotal>${fmtMoney(montoGravadoTotal)}</MontoGravadoTotal>` : ''}
      ${base18 > 0 ? `<MontoGravadoI1>${fmtMoney(base18)}</MontoGravadoI1>` : ''}
      ${base16 > 0 ? `<MontoGravadoI2>${fmtMoney(base16)}</MontoGravadoI2>` : ''}
      ${base0 > 0 ? `<MontoGravadoI3>${fmtMoney(base0)}</MontoGravadoI3>` : ''}
      ${exempt > 0 ? `<MontoExento>${fmtMoney(exempt)}</MontoExento>` : ''}
      ${totalITBIS > 0 ? `<TotalITBIS>${fmtMoney(totalITBIS)}</TotalITBIS>` : ''}
      ${amount18 > 0 ? `<TotalITBIS1>${fmtMoney(amount18)}</TotalITBIS1>` : ''}
      ${amount16 > 0 ? `<TotalITBIS2>${fmtMoney(amount16)}</TotalITBIS2>` : ''}
      ${additionalTaxesAmount > 0 ? `<MontoImpuestoAdicional>${fmtMoney(additionalTaxesAmount)}</MontoImpuestoAdicional>` : ''}${impuestosAdicionalesXml}
      <MontoTotal>${fmtMoney(total)}</MontoTotal>
      ${montoNoFacturable !== undefined && montoNoFacturable !== null ? `<MontoNoFacturable>${fmtMoney(montoNoFacturable)}</MontoNoFacturable>` : ''}
      ${montoPeriodo !== undefined && montoPeriodo !== null ? `<MontoPeriodo>${fmtMoney(montoPeriodo)}</MontoPeriodo>` : ''}
    </Totales>
    <CodigoSeguridadeCF>${esc(codigoSeguridad)}</CodigoSeguridadeCF>
  </Encabezado>
</RFCE>`;

    xml = removeEmptyTags(xml);
    return xml;
}


// ============================================================
// 6. VALIDACIÓN CONTRA XSD OFICIAL DE DGII
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
    'rfce32': 'docs/dgii/xsd/rfce32/RFCE 32 v.1.0.xsd',
};

const xsdCache = {};

function loadXSD(type) {
    const typeStr = String(type);
    if (xsdCache[typeStr]) return xsdCache[typeStr];

    const xsdPath = XSD_PATH_BY_TYPE[typeStr];
    if (!xsdPath) throw new Error(`No XSD configured for type ${typeStr}`);

    const fullPath = path.resolve(process.cwd(), xsdPath);
    if (!fs.existsSync(fullPath)) throw new Error(`XSD not found: ${fullPath}`);

    const rawBuffer = fs.readFileSync(fullPath);
    const hasBOM = rawBuffer.length >= 3 &&
        rawBuffer[0] === 0xef && rawBuffer[1] === 0xbb && rawBuffer[2] === 0xbf;

    let xsdContent = rawBuffer.toString('utf8');
    if (hasBOM) xsdContent = xsdContent.replace(/^\uFEFF/, '');

    let xsdDoc;
    try {
        xsdDoc = libxml.parseXml(xsdContent);
    } catch (parseErr) {
        const firstChars = xsdContent.slice(0, 60).replace(/\n/g, '\\n');
        const detail = [
            `Failed to parse XSD for type ${typeStr}`,
            `  path: ${fullPath}`,
            `  hasBOM: ${hasBOM}`,
            `  bytes: ${rawBuffer.length}`,
            `  firstChars: "${firstChars}"`,
            `  originalError: ${parseErr.message}`
        ].join('\n');
        throw new Error(detail);
    }

    xsdCache[typeStr] = xsdDoc;
    return xsdDoc;
}

function validateBasicPreChecks(xml, type) {
    const errors = [];

    if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
        return { valid: false, errors: ['XML is empty or invalid'] };
    }

    if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
        errors.push('Missing XML declaration or wrong encoding');
    }

    const validTypes = ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'];
    if (!validTypes.includes(String(type))) {
        errors.push(`Invalid e-CF type: ${type}`);
    }

    return { valid: errors.length === 0, errors };
}

function validateAgainstXSD(xml, type) {
    const preCheck = validateBasicPreChecks(xml, type);
    if (!preCheck.valid) return preCheck;

    let xmlDoc;
    try {
        xmlDoc = libxml.parseXml(xml);
    } catch (parseError) {
        return { valid: false, errors: [`XML parse error: ${parseError.message}`] };
    }

    let xsdDoc;
    try {
        xsdDoc = loadXSD(type);
    } catch (xsdError) {
        return { valid: false, errors: [`XSD load error: ${xsdError.message}`] };
    }

    let isValid;
    try {
        isValid = xmlDoc.validate(xsdDoc);
    } catch (validationError) {
        return { valid: false, errors: [`XSD validation threw: ${validationError.message}`] };
    }

    const errors = [];
    if (!isValid) {
        for (const err of xmlDoc.validationErrors) {
            errors.push((err.message || '').trim());
        }
    }

    return { valid: isValid, errors };
}

function clearXSDCache() {
    for (const key of Object.keys(xsdCache)) delete xsdCache[key];
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
    generateECF33,
    generateECF34,
    generateECF41,
    generateECF43,
    generateECF44,
    generateECF45,
    generateECF46,
    generateECF47,
    buildRFCE,
    buildECFBody,
    validateAgainstXSD,
    clearXSDCache
};