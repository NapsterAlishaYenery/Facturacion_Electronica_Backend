// ============================================================
// LIBRERÍAS
// ============================================================
const fs = require('fs');
const path = require('path');
const libxml = require('libxmljs2');

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
// 3. CONSTRUCTOR BASE DE e-CF (reutilizable por todos los tipos)
// ============================================================
// ============================================================
// 3. CONSTRUCTOR BASE DE e-CF (reutilizable por todos los tipos)
// ============================================================
//
// Soporta los tipos 31, 32, 33 y 34.
// Cada tipo tiene diferencias que se manejan con flags calculados aquí.
//
// | Elemento                      | 31 | 32 | 33 | 34 |
// |-------------------------------|----|----|----|----|
// | FechaVencimientoSecuencia     | ✅ | ❌ | ✅ | ❌ |
// | IndicadorNotaCredito          | ❌ | ❌ | ❌ | ✅ |
// | TablaFormasPago / TerminoPago | ✅ | ✅ | ✅ | ❌ |
// | InformacionReferencia         | ❌ | ❌ | ✅ | ✅ |
// | Comprador                     | obl| opc| opc| opc|
// ============================================================

function buildECFBody(invoiceData, options) {
    const { type, requireReceiver } = options;

    // 🔥 Flags de tipo — cada uno activa/desactiva bloques del XSD correspondiente.
    const is31 = String(type) === '31';
    const is33 = String(type) === '33';
    const is34 = String(type) === '34';
    const isNota = is33 || is34;                    // 33 y 34 comparten InformacionReferencia

    // 🔥 FechaVencimientoSecuencia: solo 31 y 33 (los XSD 32 y 34 NO lo tienen).
    const needsFechaVencimiento = is31 || is33;

    // 🔥 Bloques de pago (TablaFormasPago, TerminoPago, FechaLimitePago, etc.):
    //    31, 32 y 33 sí. El XSD 34 NO tiene TablaFormasPago ni TerminoPago.
    const supportsPaymentInfo = !is34;

    const {
        ncf,
        sequenceExpiresAt,
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
        receiverRnc,
        receiverName,
        paymentType = 1,
        paymentDeadline,
        paymentTerms,
        paymentMethods = [],
        issuedAt,
        subtotal,
        itbis,
        total,
        lines,
        itbis1Base,
        itbis1Amount,
        itbis2Base,
        itbis2Amount,
        itbis3Base,
        exemptAmount,
        // 🔥 Campos específicos de Notas (33 y 34):
        modifiedNcf,            // NCFModificado (obligatorio en 33 y 34)
        modifiedNcfIssuerRnc,   // RNCOtroContribuyente (opcional)
        modifiedNcfDate,        // FechaNCFModificado (obligatorio en 33 y 34)
        modificationCode,       // CodigoModificacion (obligatorio en 33 y 34)
        modificationReason,     // RazonModificacion (opcional en 33 y 34)
        // 🔥 Campo específico SOLO del 34:
        indicadorNotaCredito    // IndicadorNotaCredito (obligatorio en 34; 0 o 1)
    } = invoiceData;

    const esc = escapeXMLSpecialChars;

    // ------------------------------------------------------------
    // Validaciones por tipo
    // ------------------------------------------------------------
    if (requireReceiver) {
        if (!receiverRnc) throw new Error(`RNC Comprador is required for e-CF type ${type}`);
        if (!receiverName) throw new Error(`Razón Social Comprador is required for e-CF type ${type}`);
    }

    // 🔥 Validación compartida por 33 y 34
    if (isNota) {
        if (!modifiedNcf) throw new Error(`NCFModificado is required for e-CF type ${type}`);
        if (!modifiedNcfDate) throw new Error(`FechaNCFModificado is required for e-CF type ${type}`);
        if (!modificationCode) throw new Error(`CodigoModificacion is required for e-CF type ${type}`);
    }

    // 🔥 Validación específica del 34: IndicadorNotaCredito obligatorio (0 o 1)
    if (is34) {
        if (indicadorNotaCredito === null || indicadorNotaCredito === undefined) {
            throw new Error(`IndicadorNotaCredito is required for e-CF type 34 (0 or 1)`);
        }
        const inc = Number(indicadorNotaCredito);
        if (inc !== 0 && inc !== 1) {
            throw new Error(`IndicadorNotaCredito must be 0 or 1 for e-CF type 34`);
        }
    }

    // ------------------------------------------------------------
    // Cálculos de totales
    // ------------------------------------------------------------
    const base18 = Number(itbis1Base || subtotal || 0);
    const amount18 = Number(itbis1Amount || itbis || 0);
    const base16 = Number(itbis2Base || 0);
    const amount16 = Number(itbis2Amount || 0);
    const base0 = Number(itbis3Base || 0);
    const exempt = Number(exemptAmount || 0);

    const montoGravadoTotal = base18 + base16 + base0;
    const totalITBIS = amount18 + amount16;

    // 🔥 FechaVencimientoSecuencia: 31 y 33 lo llevan; 32 y 34 no.
    const fechaVencimientoSecuencia = needsFechaVencimiento && sequenceExpiresAt
        ? `<FechaVencimientoSecuencia>${fmtDate(sequenceExpiresAt)}</FechaVencimientoSecuencia>`
        : '';

    // 🔥 IndicadorNotaCredito: SOLO tipo 34.
    const indicadorNotaCreditoXml = is34
        ? `<IndicadorNotaCredito>${Number(indicadorNotaCredito)}</IndicadorNotaCredito>`
        : '';

    // ------------------------------------------------------------
    // Bloques de pago (dependientes del tipo)
    // ------------------------------------------------------------
    // 🔥 En 34 solo sobrevive FechaLimitePago (que sí está en el XSD 34).
    //    TablaFormasPago y TerminoPago NO existen en el XSD 34.
    let paymentBlocks = '';
    if (supportsPaymentInfo) {
        // 31, 32, 33 → estructura completa
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
        // 34 → solo FechaLimitePago (si aplica)
        paymentBlocks = `
      ${paymentType === 2 && paymentDeadline ? `<FechaLimitePago>${fmtDate(paymentDeadline)}</FechaLimitePago>` : ''}`;
    }

    // Comprador: contenedor común a los 4 tipos.
    const compradorBlock = `
    <Comprador>
      ${receiverRnc ? `<RNCComprador>${esc(receiverRnc)}</RNCComprador>` : ''}
      ${receiverName ? `<RazonSocialComprador>${esc(receiverName)}</RazonSocialComprador>` : ''}
    </Comprador>`;

    const encabezado = `
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoeCF>${type}</TipoeCF>
      <eNCF>${esc(ncf)}</eNCF>
      ${indicadorNotaCreditoXml}
      ${fechaVencimientoSecuencia}
      <IndicadorMontoGravado>0</IndicadorMontoGravado>
      <TipoIngresos>01</TipoIngresos>
      <TipoPago>${paymentType}</TipoPago>
      ${paymentBlocks}
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
    </Emisor>${compradorBlock}
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
      ${line.itemCode ? `
      <TablaCodigosItem>
        <CodigosItem>
          <TipoCodigo>Interna</TipoCodigo>
          <CodigoItem>${esc(line.itemCode)}</CodigoItem>
        </CodigosItem>
      </TablaCodigosItem>` : ''}
      <IndicadorFacturacion>${indicadorFacturacion}</IndicadorFacturacion>
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

    // 🔥 InformacionReferencia: bloque obligatorio en 33 y 34.
    //    Va DESPUÉS de <DetallesItems> y ANTES de <FechaHoraFirma>.
    let informacionReferencia = '';
    if (isNota) {
        informacionReferencia = `
  <InformacionReferencia>
    <NCFModificado>${esc(modifiedNcf)}</NCFModificado>
    ${modifiedNcfIssuerRnc ? `<RNCOtroContribuyente>${esc(modifiedNcfIssuerRnc)}</RNCOtroContribuyente>` : ''}
    <FechaNCFModificado>${fmtDate(modifiedNcfDate)}</FechaNCFModificado>
    <CodigoModificacion>${modificationCode}</CodigoModificacion>
    ${modificationReason ? `<RazonModificacion>${esc(modificationReason)}</RazonModificacion>` : ''}
  </InformacionReferencia>`;
    }

    const fechaHoraFirma = `
  <FechaHoraFirma>${fmtDateTime(new Date())}</FechaHoraFirma>`;

    // 🔥 Se inserta informacionReferencia entre DetallesItems y FechaHoraFirma.
    //    Para 31 y 32 es '' (string vacío), así que el XML es idéntico al anterior.
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>${encabezado}${detallesItems}${informacionReferencia}${fechaHoraFirma}
</ECF>`;

    xml = removeEmptyTags(xml);
    return xml;
}

// ============================================================
// 4. GENERADORES POR TIPO
// ============================================================

function generateECF32(invoiceData) {
    return buildECFBody(invoiceData, { type: '32', requireReceiver: false });
}

function generateECF31(invoiceData) {
    return buildECFBody(invoiceData, { type: '31', requireReceiver: true });
}

// 🔥 e-CF 33: Nota de Débito.
//    Requiere comprador identificado (en la práctica).
//    Requiere: modifiedNcf, modifiedNcfDate, modificationCode.
function generateECF33(invoiceData) {
    return buildECFBody(invoiceData, { type: '33', requireReceiver: true });
}

// 🔥 e-CF 34: Nota de Crédito.
//    Comprador opcional según XSD (minOccurs=0).
//    Requiere: modifiedNcf, modifiedNcfDate, modificationCode, indicadorNotaCredito.
//    NO lleva sequenceExpiresAt, paymentMethods ni paymentTerms.
function generateECF34(invoiceData) {
    return buildECFBody(invoiceData, { type: '34', requireReceiver: false });
}

// ============================================================
// 5. GENERADOR DE RFCE (Resumen de Factura de Consumo)
// ============================================================

function buildRFCE(rfceData) {
    const { issuerRnc, issuerName, periodFrom, periodTo, issuedAt, invoices } = rfceData;
    const esc = escapeXMLSpecialChars;

    if (!invoices || invoices.length === 0) {
        throw new Error('RFCE requires at least one invoice');
    }

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
    '47': 'docs/dgii/xsd/ecf47/e-CF 47 v.1.0.xsd'
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
    buildRFCE,
    buildECFBody,
    validateAgainstXSD,
    clearXSDCache
};