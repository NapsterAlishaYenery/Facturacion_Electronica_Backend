// ============================================================
// LIBRERÍAS
// ============================================================
const fs = require('fs');
const path = require('path');
const { getTypeProfile } = require('./type-profiles2');

// ============================================================
// HELPERS INTERNOS DEL MÓDULO (no se exportan)
// ============================================================

// En xml-generator.js, dentro de buildEmisor:
function formatPhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (last10.length !== 10) return null;
    return `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`;
}

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

function getIndicadorFacturacion(line) {
    if (line && line.indicadorFacturacion !== undefined && line.indicadorFacturacion !== null) {
        return Number(line.indicadorFacturacion);
    }
    const rate = Number(line && line.itbisRate);
    if (Number.isNaN(rate)) return 4;
    if (rate === 18) return 1;
    if (rate === 16) return 2;
    if (rate === 0) return 4;
    return 4;
}

// ============================================================
// 1. UTILIDADES DE ESCAPADO Y LIMPIEZA XML
// ============================================================

function escapeXMLSpecialChars(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

const esc = escapeXMLSpecialChars;
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

    currentXml = currentXml
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.trim() !== '')
        .join('\n');

    currentXml = currentXml.replace(/\n{2,}/g, '\n');

    return currentXml;
}

// ============================================================
// 2. CONSTRUCCIÓN DEL CÓDIGO QR
// ============================================================

function buildQRCodeData(invoiceData) {
    const { issuerRnc, ncf, receiverRnc, total, issuedAt, type, signedAt, securityCode } = invoiceData;
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

/**
 * Validaciones específicas por tipo, guiadas por el perfil.
 */
/**
 * Validaciones de negocio por tipo, guiadas por el perfil.
 * Lanza Error si falta un campo obligatorio.
 */
function validateForType(invoiceData, profile) {
    const { code } = profile;

    // ------- Comprador -------
    if (profile.comprador.present) {
        if (profile.comprador.rncRequired && !invoiceData.receiverRnc) {
            throw new Error(`Tipo ${code}: RNC Comprador es obligatorio`);
        }
        if (profile.comprador.razonSocialRequired && !invoiceData.receiverName) {
            throw new Error(`Tipo ${code}: Razón Social Comprador es obligatoria`);
        }
        // 46/47: si no hay RNC, debe haber IdentificadorExtranjero
        if (profile.comprador.hasIdentificadorExtranjero && !invoiceData.receiverRnc && !invoiceData.receiverIdentificadorExtranjero) {
            throw new Error(`Tipo ${code}: debe tener RNC Comprador o Identificador Extranjero`);
        }
    }

    // ------- IdDoc -------
    if (profile.idDoc.hasFechaVencimientoSecuencia && !invoiceData.sequenceExpiresAt) {
        throw new Error(`Tipo ${code}: FechaVencimientoSecuencia es obligatoria`);
    }
    if (profile.idDoc.hasIndicadorNotaCredito) {
        if (invoiceData.indicadorNotaCredito === null || invoiceData.indicadorNotaCredito === undefined) {
            throw new Error(`Tipo ${code}: IndicadorNotaCredito es obligatorio (0 o 1)`);
        }
        const inc = Number(invoiceData.indicadorNotaCredito);
        if (inc !== 0 && inc !== 1) {
            throw new Error(`Tipo ${code}: IndicadorNotaCredito debe ser 0 o 1`);
        }
    }

    if (profile.idDoc.hasTipoPago && Number(invoiceData.tipoPago) === 2) {
        if (profile.idDoc.hasFechaLimitePago && !invoiceData.fechaLimitePago) {
            throw new Error(`Tipo ${code}: FechaLimitePago es obligatoria cuando TipoPago=2`);
        }
    }

    // ------- Notas 33/34 -------
    if (profile.taxRules.isNota) {
        if (!invoiceData.modifiedNcf) throw new Error(`Tipo ${code}: NCFModificado es obligatorio`);
        if (!invoiceData.modifiedNcfDate) throw new Error(`Tipo ${code}: FechaNCFModificado es obligatoria`);
        if (!invoiceData.modificationCode) throw new Error(`Tipo ${code}: CodigoModificacion es obligatorio`);
    }

    // ------- Retención obligatoria (41 y 47) -------
    if (profile.items.retencionRequired) {
        for (let i = 0; i < (invoiceData.lines || []).length; i++) {
            const line = invoiceData.lines[i];
            if (!line.retencion) {
                throw new Error(`Tipo ${code}: Retención obligatoria en línea ${i + 1}`);
            }
        }
    }

    // ------- Max monto total (43) -------
    if (profile.taxRules.maxMontoTotal && Number(invoiceData.total) > profile.taxRules.maxMontoTotal) {
        throw new Error(
            `Tipo ${code}: MontoTotal (${invoiceData.total}) excede el máximo permitido (${profile.taxRules.maxMontoTotal})`
        );
    }

    // ------- Items forzados -------
    for (let i = 0; i < (invoiceData.lines || []).length; i++) {
        const line = invoiceData.lines[i];

        if (profile.items.indicadorFacturacionForced !== undefined) {
            const ind = getIndicadorFacturacion(line);
            if (Number(ind) !== profile.items.indicadorFacturacionForced) {
                throw new Error(
                    `Tipo ${code}: línea ${i + 1} requiere indicadorFacturacion=${profile.items.indicadorFacturacionForced}, recibido ${ind}`
                );
            }
        }

        if (profile.items.indicadorBienoServicioForced !== undefined) {
            const ind = Number(line.indicadorBienoServicio ?? 1);
            if (ind !== profile.items.indicadorBienoServicioForced) {
                throw new Error(
                    `Tipo ${code}: línea ${i + 1} requiere indicadorBienoServicio=${profile.items.indicadorBienoServicioForced}, recibido ${ind}`
                );
            }
        }
    }
}

/**
 * Cálculo de totales en base a las líneas + datos del invoice.
 */
function computeTotals(invoiceData) {
    const {
        subtotal, itbis, total, lines = [],
        montoGravado,
        itbis1Base, itbis1Amount,
        itbis2Base, itbis2Amount,
        itbis3Base, itbis3Amount,
        exemptAmount,
        montoImpuestoAdicional: montoImpuestoAdicionalRaw,
    } = invoiceData;

    const base18 = Number(itbis1Base ?? subtotal ?? 0);
    const amount18 = Number(itbis1Amount ?? itbis ?? 0);
    const base16 = Number(itbis2Base || 0);
    const amount16 = Number(itbis2Amount || 0);
    const base0 = Number(itbis3Base || 0);
    const amount0 = Number(itbis3Amount || 0);
    const exempt = Number(exemptAmount || 0);

    const montoGravadoTotal = montoGravado !== undefined
        ? Number(montoGravado)
        : (base18 + base16 + base0);

    const totalITBIS = amount18 + amount16 + amount0;

    // Monto impuesto adicional: si no viene, calcular desde líneas
    let montoImpuestoAdicional = Number(montoImpuestoAdicionalRaw || 0);
    if (!montoImpuestoAdicional && Array.isArray(invoiceData.impuestosAdicionales)) {
        for (const it of invoiceData.impuestosAdicionales) {
            montoImpuestoAdicional += Number(it.iscEspecifico || 0) + Number(it.iscAdvalorem || 0) + Number(it.otros || 0);
        }
    }

    return {
        base18, amount18,
        base16, amount16,
        base0, amount0,
        exempt,
        montoGravadoTotal, totalITBIS,
        total: Number(total || 0),
        montoImpuestoAdicional,
        lines,
    };
}

// ------------------------------------------------------------
// BLOQUES INTERNOS
// ------------------------------------------------------------
function buildIdDoc(invoiceData, profile) {
    const {
        ncf, sequenceExpiresAt, tipoPago = 1,
        fechaLimitePago, terminoPago, formasPago = [],
        indicadorNotaCredito,
        indicadorEnvioDiferido, indicadorMontoGravado, indicadorServicioTodoIncluido,
        tipoIngresos,
        tipoCuentaPago, numeroCuentaPago, bancoPago,
        fechaDesde, fechaHasta, totalPaginas,
    } = invoiceData;

    const fechaVencimientoSecuenciaXml = (profile.idDoc.hasFechaVencimientoSecuencia && sequenceExpiresAt)
        ? `<FechaVencimientoSecuencia>${fmtDate(sequenceExpiresAt)}</FechaVencimientoSecuencia>`
        : '';

    const indicadorNotaCreditoXml = profile.idDoc.hasIndicadorNotaCredito
        ? `<IndicadorNotaCredito>${Number(indicadorNotaCredito)}</IndicadorNotaCredito>`
        : '';

    const indicadorEnvioDiferidoXml = (profile.idDoc.hasIndicadorEnvioDiferido && indicadorEnvioDiferido !== null && indicadorEnvioDiferido !== undefined)
        ? `<IndicadorEnvioDiferido>${Number(indicadorEnvioDiferido)}</IndicadorEnvioDiferido>`
        : '';

    const indicadorMontoGravadoXml = (profile.idDoc.hasIndicadorMontoGravado && indicadorMontoGravado !== null && indicadorMontoGravado !== undefined)
        ? `<IndicadorMontoGravado>${Number(indicadorMontoGravado)}</IndicadorMontoGravado>`
        : '';

    const indicadorServicioTodoIncluidoXml = (profile.idDoc.hasIndicadorServicioTodoIncluido && indicadorServicioTodoIncluido !== null && indicadorServicioTodoIncluido !== undefined)
        ? `<IndicadorServicioTodoIncluido>${Number(indicadorServicioTodoIncluido)}</IndicadorServicioTodoIncluido>`
        : '';

    const tipoIngresosXml = profile.idDoc.hasTipoIngresos
        ? `<TipoIngresos>${esc(tipoIngresos || profile.idDoc.tipoIngresosDefault || '01')}</TipoIngresos>`
        : '';

    const tipoPagoXml = profile.idDoc.hasTipoPago
        ? `<TipoPago>${Number(tipoPago ?? profile.idDoc.tipoPagoDefault ?? 1)}</TipoPago>`
        : '';

    const fechaLimitePagoXml = (profile.idDoc.hasFechaLimitePago && fechaLimitePago)
        ? `<FechaLimitePago>${fmtDate(fechaLimitePago)}</FechaLimitePago>`
        : '';

    const terminoPagoXml = (profile.idDoc.hasTerminoPago && terminoPago)
        ? `<TerminoPago>${esc(terminoPago)}</TerminoPago>`
        : '';

    const formasPagoXml = (profile.idDoc.hasTablaFormasPago && Array.isArray(formasPago) && formasPago.length > 0)
        ? `
      <TablaFormasPago>
        ${formasPago.slice(0, profile.idDoc.formasPagoMax || 7).map(pm => `
        <FormaDePago>
          <FormaPago>${Number(pm.formaPago ?? pm.method)}</FormaPago>
          <MontoPago>${fmtMoney(pm.montoPago ?? pm.amount)}</MontoPago>
        </FormaDePago>`).join('')}
      </TablaFormasPago>`
        : '';

    const tipoCuentaPagoXml = (profile.idDoc.hasTipoCuentaPago && tipoCuentaPago)
        ? `<TipoCuentaPago>${esc(tipoCuentaPago)}</TipoCuentaPago>`
        : '';

    const numeroCuentaPagoXml = (profile.idDoc.hasNumeroCuentaPago && numeroCuentaPago)
        ? `<NumeroCuentaPago>${esc(numeroCuentaPago)}</NumeroCuentaPago>`
        : '';

    const bancoPagoXml = (profile.idDoc.hasBancoPago && bancoPago)
        ? `<BancoPago>${esc(bancoPago)}</BancoPago>`
        : '';

    const fechaDesdeXml = (profile.idDoc.hasFechaDesde && fechaDesde)
        ? `<FechaDesde>${fmtDate(fechaDesde)}</FechaDesde>`
        : '';

    const fechaHastaXml = (profile.idDoc.hasFechaHasta && fechaHasta)
        ? `<FechaHasta>${fmtDate(fechaHasta)}</FechaHasta>`
        : '';

    const totalPaginasXml = (profile.idDoc.hasTotalPaginas && Number(totalPaginas) > 1)
        ? `<TotalPaginas>${Number(totalPaginas)}</TotalPaginas>`
        : '';

    return `
    <IdDoc>
      <TipoeCF>${profile.code}</TipoeCF>
      <eNCF>${esc(ncf)}</eNCF>
      ${indicadorNotaCreditoXml}
      ${indicadorEnvioDiferidoXml}
      ${indicadorMontoGravadoXml}
      ${indicadorServicioTodoIncluidoXml}
      ${fechaVencimientoSecuenciaXml}
      ${tipoIngresosXml}
      ${tipoPagoXml}
      ${fechaLimitePagoXml}
      ${terminoPagoXml}
      ${formasPagoXml}
      ${tipoCuentaPagoXml}
      ${numeroCuentaPagoXml}
      ${bancoPagoXml}
      ${fechaDesdeXml}
      ${fechaHastaXml}
      ${totalPaginasXml}
    </IdDoc>`;
}

function buildEmisor(invoiceData, profile) {
    const {
        issuerRnc, issuerName, issuerTradeName,
        issuerAddress, issuerMunicipio, issuerProvincia,
        issuerPhone, issuerPhones, issuerEmail, issuerWebsite,
        issuerEconomicActivity, issuerSucursal,
        issuedAt,
        codigoVendedor, numeroFacturaInterna, numeroPedidoInterno,
        zonaVenta, rutaVenta, informacionAdicionalEmisor,
    } = invoiceData;

    const nombreComercialXml = (profile.emisor.hasNombreComercial && issuerTradeName)
        ? `<NombreComercial>${esc(issuerTradeName)}</NombreComercial>`
        : '';

    const sucursalXml = (profile.emisor.hasSucursal && issuerSucursal)
        ? `<Sucursal>${esc(issuerSucursal)}</Sucursal>`
        : '';

    const municipioXml = (profile.emisor.hasMunicipio && issuerMunicipio)
        ? `<Municipio>${esc(issuerMunicipio)}</Municipio>`
        : '';

    const provinciaXml = (profile.emisor.hasProvincia && issuerProvincia)
        ? `<Provincia>${esc(issuerProvincia)}</Provincia>`
        : '';

    // Teléfonos (hasta 3)
    let telefonosXml = '';
    if (profile.emisor.hasTablaTelefonoEmisor) {
        const phones = [];
        if (issuerPhone) phones.push(issuerPhone);
        if (Array.isArray(issuerPhones)) phones.push(...issuerPhones);
        const maxTel = profile.emisor.telefonoEmisorMax || 3;
        const validPhones = phones
            .slice(0, maxTel)
            .map(p => formatPhone(p))
            .filter(Boolean);
        if (validPhones.length > 0) {
            telefonosXml = `
      <TablaTelefonoEmisor>
        ${validPhones.map(p => `<TelefonoEmisor>${esc(p)}</TelefonoEmisor>`).join('')}
      </TablaTelefonoEmisor>`;
        }
    }

    const correoXml = (profile.emisor.hasCorreoEmisor && issuerEmail)
        ? `<CorreoEmisor>${esc(issuerEmail)}</CorreoEmisor>`
        : '';

    const websiteXml = (profile.emisor.hasWebSite && issuerWebsite)
        ? `<WebSite>${esc(issuerWebsite)}</WebSite>`
        : '';

    const actividadXml = (profile.emisor.hasActividadEconomica && issuerEconomicActivity)
        ? `<ActividadEconomica>${esc(issuerEconomicActivity)}</ActividadEconomica>`
        : '';

    const codigoVendedorXml = (profile.emisor.hasCodigoVendedor && codigoVendedor)
        ? `<CodigoVendedor>${esc(codigoVendedor)}</CodigoVendedor>`
        : '';

    const numeroFacturaInternaXml = (profile.emisor.hasNumeroFacturaInterna && numeroFacturaInterna)
        ? `<NumeroFacturaInterna>${esc(numeroFacturaInterna)}</NumeroFacturaInterna>`
        : '';

    const numeroPedidoInternoXml = (profile.emisor.hasNumeroPedidoInterno && numeroPedidoInterno)
        ? `<NumeroPedidoInterno>${esc(numeroPedidoInterno)}</NumeroPedidoInterno>`
        : '';

    const zonaVentaXml = (profile.emisor.hasZonaVenta && zonaVenta)
        ? `<ZonaVenta>${esc(zonaVenta)}</ZonaVenta>`
        : '';

    const rutaVentaXml = (profile.emisor.hasRutaVenta && rutaVenta)
        ? `<RutaVenta>${esc(rutaVenta)}</RutaVenta>`
        : '';

    const infoAdicionalXml = (profile.emisor.hasInformacionAdicionalEmisor && informacionAdicionalEmisor)
        ? `<InformacionAdicionalEmisor>${esc(informacionAdicionalEmisor)}</InformacionAdicionalEmisor>`
        : '';

    return `
    <Emisor>
      <RNCEmisor>${esc(issuerRnc)}</RNCEmisor>
      <RazonSocialEmisor>${esc(issuerName)}</RazonSocialEmisor>
      ${nombreComercialXml}
      ${sucursalXml}
      <DireccionEmisor>${esc(issuerAddress)}</DireccionEmisor>
      ${municipioXml}
      ${provinciaXml}
      ${telefonosXml}
      ${correoXml}
      ${websiteXml}
      ${actividadXml}
      ${codigoVendedorXml}
      ${numeroFacturaInternaXml}
      ${numeroPedidoInternoXml}
      ${zonaVentaXml}
      ${rutaVentaXml}
      ${infoAdicionalXml}
      <FechaEmision>${fmtDate(issuedAt)}</FechaEmision>
    </Emisor>`;
}

function buildComprador(invoiceData, profile) {
    if (!profile.comprador.present) return '';

    const {
        receiverRnc, receiverName, receiverIdentificadorExtranjero, receiverPais,
        contactoComprador, correoComprador, direccionComprador,
        municipioComprador, provinciaComprador,
        fechaEntrega, contactoEntrega, direccionEntrega, telefonoAdicional,
        fechaOrdenCompra, numeroOrdenCompra, codigoInternoComprador,
        responsablePago, informacionAdicionalComprador,
    } = invoiceData;

    const rncXml = (profile.comprador.hasRNCComprador && receiverRnc)
        ? `<RNCComprador>${esc(receiverRnc)}</RNCComprador>`
        : '';

    const identExtXml = (profile.comprador.hasIdentificadorExtranjero && receiverIdentificadorExtranjero)
        ? `<IdentificadorExtranjero>${esc(receiverIdentificadorExtranjero)}</IdentificadorExtranjero>`
        : '';

    const razonSocialXml = (profile.comprador.hasRazonSocialComprador && receiverName)
        ? `<RazonSocialComprador>${esc(receiverName)}</RazonSocialComprador>`
        : '';

    const paisXml = (profile.comprador.hasPaisComprador && receiverPais)
        ? `<PaisComprador>${esc(receiverPais)}</PaisComprador>`
        : '';

    const contactoXml = (profile.comprador.hasContactoComprador && contactoComprador)
        ? `<ContactoComprador>${esc(contactoComprador)}</ContactoComprador>`
        : '';

    const correoXml = (profile.comprador.hasCorreoComprador && correoComprador)
        ? `<CorreoComprador>${esc(correoComprador)}</CorreoComprador>`
        : '';

    const direccionXml = (profile.comprador.hasDireccionComprador && direccionComprador)
        ? `<DireccionComprador>${esc(direccionComprador)}</DireccionComprador>`
        : '';

    const municipioXml = (profile.comprador.hasMunicipioComprador && municipioComprador)
        ? `<MunicipioComprador>${esc(municipioComprador)}</MunicipioComprador>`
        : '';

    const provinciaXml = (profile.comprador.hasProvinciaComprador && provinciaComprador)
        ? `<ProvinciaComprador>${esc(provinciaComprador)}</ProvinciaComprador>`
        : '';

    const fechaEntregaXml = (profile.comprador.hasFechaEntrega && fechaEntrega)
        ? `<FechaEntrega>${fmtDate(fechaEntrega)}</FechaEntrega>`
        : '';

    const contactoEntregaXml = (profile.comprador.hasContactoEntrega && contactoEntrega)
        ? `<ContactoEntrega>${esc(contactoEntrega)}</ContactoEntrega>`
        : '';

    const direccionEntregaXml = (profile.comprador.hasDireccionEntrega && direccionEntrega)
        ? `<DireccionEntrega>${esc(direccionEntrega)}</DireccionEntrega>`
        : '';

    const telefonoAdicionalXml = (profile.comprador.hasTelefonoAdicional && telefonoAdicional)
        ? `<TelefonoAdicional>${esc(formatPhone(telefonoAdicional) || telefonoAdicional)}</TelefonoAdicional>`
        : '';

    const fechaOrdenCompraXml = (profile.comprador.hasFechaOrdenCompra && fechaOrdenCompra)
        ? `<FechaOrdenCompra>${fmtDate(fechaOrdenCompra)}</FechaOrdenCompra>`
        : '';

    const numeroOrdenCompraXml = (profile.comprador.hasNumeroOrdenCompra && numeroOrdenCompra)
        ? `<NumeroOrdenCompra>${esc(numeroOrdenCompra)}</NumeroOrdenCompra>`
        : '';

    const codigoInternoXml = (profile.comprador.hasCodigoInternoComprador && codigoInternoComprador)
        ? `<CodigoInternoComprador>${esc(codigoInternoComprador)}</CodigoInternoComprador>`
        : '';

    const responsablePagoXml = (profile.comprador.hasResponsablePago && responsablePago)
        ? `<ResponsablePago>${esc(responsablePago)}</ResponsablePago>`
        : '';

    const infoAdicionalXml = (profile.comprador.hasInformacionAdicionalComprador && informacionAdicionalComprador)
        ? `<Informacionadicionalcomprador>${esc(informacionAdicionalComprador)}</Informacionadicionalcomprador>`
        : '';

    return `
    <Comprador>
      ${rncXml}
      ${identExtXml}
      ${razonSocialXml}
      ${contactoXml}
      ${correoXml}
      ${direccionXml}
      ${municipioXml}
      ${provinciaXml}
      ${paisXml}
      ${fechaEntregaXml}
      ${contactoEntregaXml}
      ${direccionEntregaXml}
      ${telefonoAdicionalXml}
      ${fechaOrdenCompraXml}
      ${numeroOrdenCompraXml}
      ${codigoInternoXml}
      ${responsablePagoXml}
      ${infoAdicionalXml}
    </Comprador>`;
}

function buildInformacionesAdicionales(invoiceData, profile) {
    if (!profile.informacionesAdicionales.present) return '';

    const info = invoiceData.informacionesAdicionales || {};

    const fields = [];
    if (profile.informacionesAdicionales.hasFechaEmbarque && info.fechaEmbarque) fields.push(`<FechaEmbarque>${fmtDate(info.fechaEmbarque)}</FechaEmbarque>`);
    if (profile.informacionesAdicionales.hasNumeroEmbarque && info.numeroEmbarque) fields.push(`<NumeroEmbarque>${esc(info.numeroEmbarque)}</NumeroEmbarque>`);
    if (profile.informacionesAdicionales.hasNumeroContenedor && info.numeroContenedor) fields.push(`<NumeroContenedor>${esc(info.numeroContenedor)}</NumeroContenedor>`);
    if (profile.informacionesAdicionales.hasNumeroReferencia && info.numeroReferencia) fields.push(`<NumeroReferencia>${esc(info.numeroReferencia)}</NumeroReferencia>`);
    if (profile.informacionesAdicionales.hasNombrePuertoEmbarque && info.nombrePuertoEmbarque) fields.push(`<NombrePuertoEmbarque>${esc(info.nombrePuertoEmbarque)}</NombrePuertoEmbarque>`);
    if (profile.informacionesAdicionales.hasCondicionesEntrega && info.condicionesEntrega) fields.push(`<CondicionesEntrega>${esc(info.condicionesEntrega)}</CondicionesEntrega>`);
    if (profile.informacionesAdicionales.hasTotalFob && info.totalFob != null) fields.push(`<TotalFob>${fmtMoney(info.totalFob)}</TotalFob>`);
    if (profile.informacionesAdicionales.hasSeguro && info.seguro != null) fields.push(`<Seguro>${fmtMoney(info.seguro)}</Seguro>`);
    if (profile.informacionesAdicionales.hasFlete && info.flete != null) fields.push(`<Flete>${fmtMoney(info.flete)}</Flete>`);
    if (profile.informacionesAdicionales.hasOtrosGastos && info.otrosGastos != null) fields.push(`<OtrosGastos>${fmtMoney(info.otrosGastos)}</OtrosGastos>`);
    if (profile.informacionesAdicionales.hasTotalCif && info.totalCif != null) fields.push(`<TotalCif>${fmtMoney(info.totalCif)}</TotalCif>`);
    if (profile.informacionesAdicionales.hasRegimenAduanero && info.regimenAduanero) fields.push(`<RegimenAduanero>${esc(info.regimenAduanero)}</RegimenAduanero>`);
    if (profile.informacionesAdicionales.hasNombrePuertoSalida && info.nombrePuertoSalida) fields.push(`<NombrePuertoSalida>${esc(info.nombrePuertoSalida)}</NombrePuertoSalida>`);
    if (profile.informacionesAdicionales.hasNombrePuertoDesembarque && info.nombrePuertoDesembarque) fields.push(`<NombrePuertoDesembarque>${esc(info.nombrePuertoDesembarque)}</NombrePuertoDesembarque>`);
    if (profile.informacionesAdicionales.hasPesoBruto && info.pesoBruto != null) fields.push(`<PesoBruto>${fmtMoney(info.pesoBruto)}</PesoBruto>`);
    if (profile.informacionesAdicionales.hasPesoNeto && info.pesoNeto != null) fields.push(`<PesoNeto>${fmtMoney(info.pesoNeto)}</PesoNeto>`);
    if (profile.informacionesAdicionales.hasUnidadPesoBruto && info.unidadPesoBruto) fields.push(`<UnidadPesoBruto>${Number(info.unidadPesoBruto)}</UnidadPesoBruto>`);
    if (profile.informacionesAdicionales.hasUnidadPesoNeto && info.unidadPesoNeto) fields.push(`<UnidadPesoNeto>${Number(info.unidadPesoNeto)}</UnidadPesoNeto>`);
    if (profile.informacionesAdicionales.hasCantidadBulto && info.cantidadBulto != null) fields.push(`<CantidadBulto>${fmtMoney(info.cantidadBulto)}</CantidadBulto>`);
    if (profile.informacionesAdicionales.hasUnidadBulto && info.unidadBulto) fields.push(`<UnidadBulto>${Number(info.unidadBulto)}</UnidadBulto>`);
    if (profile.informacionesAdicionales.hasVolumenBulto && info.volumenBulto != null) fields.push(`<VolumenBulto>${fmtMoney(info.volumenBulto)}</VolumenBulto>`);
    if (profile.informacionesAdicionales.hasUnidadVolumen && info.unidadVolumen) fields.push(`<UnidadVolumen>${Number(info.unidadVolumen)}</UnidadVolumen>`);

    if (fields.length === 0) return '';
    return `
    <InformacionesAdicionales>
      ${fields.join('\n      ')}
    </InformacionesAdicionales>`;
}

function buildTransporte(invoiceData, profile) {
    if (!profile.transporte.present) return '';

    const t = invoiceData.transporte || {};

    if (profile.transporte.extended) {
        return `
    <Transporte>
      ${(profile.transporte.hasViaTransporte && t.viaTransporte) ? `<ViaTransporte>${esc(t.viaTransporte)}</ViaTransporte>` : ''}
      ${(profile.transporte.hasPaisOrigen && t.paisOrigen) ? `<PaisOrigen>${esc(t.paisOrigen)}</PaisOrigen>` : ''}
      ${(profile.transporte.hasDireccionDestino && t.direccionDestino) ? `<DireccionDestino>${esc(t.direccionDestino)}</DireccionDestino>` : ''}
      ${(profile.transporte.hasPaisDestino && t.paisDestino) ? `<PaisDestino>${esc(t.paisDestino)}</PaisDestino>` : ''}
      ${(profile.transporte.hasRNCCompaniaTransportista && t.rncCompaniaTransportista) ? `<RNCIdentificacionCompaniaTransportista>${esc(t.rncCompaniaTransportista)}</RNCIdentificacionCompaniaTransportista>` : ''}
      ${(profile.transporte.hasNombreCompaniaTransportista && t.nombreCompaniaTransportista) ? `<NombreCompaniaTransportista>${esc(t.nombreCompaniaTransportista)}</NombreCompaniaTransportista>` : ''}
      ${(profile.transporte.hasNumeroViaje && t.numeroViaje) ? `<NumeroViaje>${esc(t.numeroViaje)}</NumeroViaje>` : ''}
      ${(profile.transporte.hasConductor && t.conductor) ? `<Conductor>${esc(t.conductor)}</Conductor>` : ''}
      ${(profile.transporte.hasDocumentoTransporte && t.documentoTransporte) ? `<DocumentoTransporte>${esc(t.documentoTransporte)}</DocumentoTransporte>` : ''}
      ${(profile.transporte.hasFicha && t.ficha) ? `<Ficha>${esc(t.ficha)}</Ficha>` : ''}
      ${(profile.transporte.hasPlaca && t.placa) ? `<Placa>${esc(t.placa)}</Placa>` : ''}
      ${(profile.transporte.hasRutaTransporte && t.rutaTransporte) ? `<RutaTransporte>${esc(t.rutaTransporte)}</RutaTransporte>` : ''}
      ${(profile.transporte.hasZonaTransporte && t.zonaTransporte) ? `<ZonaTransporte>${esc(t.zonaTransporte)}</ZonaTransporte>` : ''}
      ${(profile.transporte.hasNumeroAlbaran && t.numeroAlbaran) ? `<NumeroAlbaran>${esc(t.numeroAlbaran)}</NumeroAlbaran>` : ''}
    </Transporte>`;
    }

    if (profile.transporte.reduced) {
        return `
    <Transporte>
      ${(profile.transporte.hasPaisDestino && t.paisDestino) ? `<PaisDestino>${esc(t.paisDestino)}</PaisDestino>` : ''}
    </Transporte>`;
    }

    // full
    return `
    <Transporte>
      ${(profile.transporte.hasConductor && t.conductor) ? `<Conductor>${esc(t.conductor)}</Conductor>` : ''}
      ${(profile.transporte.hasDocumentoTransporte && t.documentoTransporte) ? `<DocumentoTransporte>${esc(t.documentoTransporte)}</DocumentoTransporte>` : ''}
      ${(profile.transporte.hasFicha && t.ficha) ? `<Ficha>${esc(t.ficha)}</Ficha>` : ''}
      ${(profile.transporte.hasPlaca && t.placa) ? `<Placa>${esc(t.placa)}</Placa>` : ''}
      ${(profile.transporte.hasRutaTransporte && t.rutaTransporte) ? `<RutaTransporte>${esc(t.rutaTransporte)}</RutaTransporte>` : ''}
      ${(profile.transporte.hasZonaTransporte && t.zonaTransporte) ? `<ZonaTransporte>${esc(t.zonaTransporte)}</ZonaTransporte>` : ''}
      ${(profile.transporte.hasNumeroAlbaran && t.numeroAlbaran) ? `<NumeroAlbaran>${esc(t.numeroAlbaran)}</NumeroAlbaran>` : ''}
    </Transporte>`;
}

function buildTotales(computed, invoiceData, profile) {
    const {
        base18, amount18, base16, amount16, base0, amount0, exempt,
        montoGravadoTotal, totalITBIS, total,
    } = computed;

    const t = profile.totales;

    // MontoGravadoTotal
    const montoGravadoTotalXml = t.hasMontoGravadoTotal
        ? `<MontoGravadoTotal>${fmtMoney(montoGravadoTotal)}</MontoGravadoTotal>` : '';

    const montoGravadoI1Xml = (t.hasMontoGravadoI1 && base18 > 0) ? `<MontoGravadoI1>${fmtMoney(base18)}</MontoGravadoI1>` : '';
    const montoGravadoI2Xml = (t.hasMontoGravadoI2 && base16 > 0) ? `<MontoGravadoI2>${fmtMoney(base16)}</MontoGravadoI2>` : '';
    const montoGravadoI3Xml = (t.hasMontoGravadoI3 && base0 > 0) ? `<MontoGravadoI3>${fmtMoney(base0)}</MontoGravadoI3>` : '';
    const montoExentoXml = (t.hasMontoExento && exempt > 0) ? `<MontoExento>${fmtMoney(exempt)}</MontoExento>` : '';

    const itbis1Xml = (t.hasITBIS1 && base18 > 0) ? `<ITBIS1>18</ITBIS1>` : '';
    const itbis2Xml = (t.hasITBIS2 && base16 > 0) ? `<ITBIS2>16</ITBIS2>` : '';
    const itbis3Xml = (t.hasITBIS3 && base0 > 0) ? `<ITBIS3>0</ITBIS3>` : '';

    const totalITBISXml = t.hasTotalITBIS ? `<TotalITBIS>${fmtMoney(totalITBIS)}</TotalITBIS>` : '';
    const totalITBIS1Xml = (t.hasTotalITBIS1 && amount18 > 0) ? `<TotalITBIS1>${fmtMoney(amount18)}</TotalITBIS1>` : '';
    const totalITBIS2Xml = (t.hasTotalITBIS2 && amount16 > 0) ? `<TotalITBIS2>${fmtMoney(amount16)}</TotalITBIS2>` : '';

    const totalITBIS3Xml = (t.hasTotalITBIS3 && base0 > 0)
        ? `<TotalITBIS3>${fmtMoney(amount0)}</TotalITBIS3>` : '';

    const montoImpuestoAdicionalXml = (t.hasMontoImpuestoAdicional && computed.montoImpuestoAdicional > 0)
        ? `<MontoImpuestoAdicional>${fmtMoney(computed.montoImpuestoAdicional)}</MontoImpuestoAdicional>` : '';

    const impuestosAdicionalesXml = (t.hasImpuestosAdicionales && Array.isArray(invoiceData.impuestosAdicionales) && invoiceData.impuestosAdicionales.length > 0)
        ? `
      <ImpuestosAdicionales>
        ${invoiceData.impuestosAdicionales.slice(0, t.impuestosAdicionalesMax || 20).map(it => `
        <ImpuestoAdicional>
          <TipoImpuesto>${esc(String(it.codigo))}</TipoImpuesto>
          ${it.tasa != null ? `<TasaImpuestoAdicional>${Number(it.tasa)}</TasaImpuestoAdicional>` : ''}
          ${it.iscEspecifico != null ? `<MontoImpuestoSelectivoConsumoEspecifico>${fmtMoney(it.iscEspecifico)}</MontoImpuestoSelectivoConsumoEspecifico>` : ''}
          ${it.iscAdvalorem != null ? `<MontoImpuestoSelectivoConsumoAdvalorem>${fmtMoney(it.iscAdvalorem)}</MontoImpuestoSelectivoConsumoAdvalorem>` : ''}
          ${it.otros != null ? `<OtrosImpuestosAdicionales>${fmtMoney(it.otros)}</OtrosImpuestoAdicionales>` : ''}
        </ImpuestoAdicional>`).join('')}
      </ImpuestosAdicionales>` : '';

    const montoTotalXml = `<MontoTotal>${fmtMoney(total)}</MontoTotal>`;

    const montoNoFacturableXml = (t.hasMontoNoFacturable && invoiceData.montoNoFacturable != null)
        ? `<MontoNoFacturable>${fmtMoney(invoiceData.montoNoFacturable)}</MontoNoFacturable>` : '';
    const montoPeriodoXml = (t.hasMontoPeriodo && invoiceData.montoPeriodo != null)
        ? `<MontoPeriodo>${fmtMoney(invoiceData.montoPeriodo)}</MontoPeriodo>` : '';
    const saldoAnteriorXml = (t.hasSaldoAnterior && invoiceData.saldoAnterior != null)
        ? `<SaldoAnterior>${fmtMoney(invoiceData.saldoAnterior)}</SaldoAnterior>` : '';
    const montoAvancePagoXml = (t.hasMontoAvancePago && invoiceData.montoAvancePago != null)
        ? `<MontoAvancePago>${fmtMoney(invoiceData.montoAvancePago)}</MontoAvancePago>` : '';
    const valorPagarXml = (t.hasValorPagar && invoiceData.valorPagar != null)
        ? `<ValorPagar>${fmtMoney(invoiceData.valorPagar)}</ValorPagar>` : '';

    const totalITBISRetenidoXml = (t.hasTotalITBISRetenido && invoiceData.totalItbisRetenido > 0)
        ? `<TotalITBISRetenido>${fmtMoney(invoiceData.totalItbisRetenido)}</TotalITBISRetenido>` : '';
    const totalISRRetencionXml = (t.hasTotalISRRetencion && invoiceData.totalIsrRetencion > 0)
        ? `<TotalISRRetencion>${fmtMoney(invoiceData.totalIsrRetencion)}</TotalISRRetencion>` : '';
    const totalITBISPercepcionXml = (t.hasTotalITBISPercepcion && invoiceData.totalItbisPercepcion > 0)
        ? `<TotalITBISPercepcion>${fmtMoney(invoiceData.totalItbisPercepcion)}</TotalITBISPercepcion>` : '';
    const totalISRPercepcionXml = (t.hasTotalISRPercepcion && invoiceData.totalIsrPercepcion > 0)
        ? `<TotalISRPercepcion>${fmtMoney(invoiceData.totalIsrPercepcion)}</TotalISRPercepcion>` : '';

    return `
    <Totales>
      ${montoGravadoTotalXml}
      ${montoGravadoI1Xml}
      ${montoGravadoI2Xml}
      ${montoGravadoI3Xml}
      ${montoExentoXml}
      ${itbis1Xml}
      ${itbis2Xml}
      ${itbis3Xml}
      ${totalITBISXml}
      ${totalITBIS1Xml}
      ${totalITBIS2Xml}
      ${totalITBIS3Xml}
      ${montoImpuestoAdicionalXml}
      ${impuestosAdicionalesXml}
      ${montoTotalXml}
      ${montoNoFacturableXml}
      ${montoPeriodoXml}
      ${saldoAnteriorXml}
      ${montoAvancePagoXml}
      ${valorPagarXml}
      ${totalITBISRetenidoXml}
      ${totalISRRetencionXml}
      ${totalITBISPercepcionXml}
      ${totalISRPercepcionXml}
    </Totales>`;
}

function buildOtraMoneda(invoiceData, profile) {
    if (!profile.otraMoneda.present) return '';
    if (!invoiceData.tipoMoneda) return '';

    const o = profile.otraMoneda;
    const f = [];

    if (o.hasTipoMoneda && invoiceData.tipoMoneda) f.push(`<TipoMoneda>${esc(invoiceData.tipoMoneda)}</TipoMoneda>`);
    if (o.hasTipoCambio && invoiceData.tipoCambio != null) f.push(`<TipoCambio>${Number(invoiceData.tipoCambio)}</TipoCambio>`);

    if (o.hasMontoGravadoTotalOtraMoneda && invoiceData.montoGravadoTotalOtraMoneda != null) f.push(`<MontoGravadoTotalOtraMoneda>${fmtMoney(invoiceData.montoGravadoTotalOtraMoneda)}</MontoGravadoTotalOtraMoneda>`);
    if (o.hasMontoGravado1OtraMoneda && invoiceData.montoGravado1OtraMoneda != null) f.push(`<MontoGravado1OtraMoneda>${fmtMoney(invoiceData.montoGravado1OtraMoneda)}</MontoGravado1OtraMoneda>`);
    if (o.hasMontoGravado2OtraMoneda && invoiceData.montoGravado2OtraMoneda != null) f.push(`<MontoGravado2OtraMoneda>${fmtMoney(invoiceData.montoGravado2OtraMoneda)}</MontoGravado2OtraMoneda>`);
    if (o.hasMontoGravado3OtraMoneda && invoiceData.montoGravado3OtraMoneda != null) f.push(`<MontoGravado3OtraMoneda>${fmtMoney(invoiceData.montoGravado3OtraMoneda)}</MontoGravado3OtraMoneda>`);
    if (o.hasMontoExentoOtraMoneda && invoiceData.montoExentoOtraMoneda != null) f.push(`<MontoExentoOtraMoneda>${fmtMoney(invoiceData.montoExentoOtraMoneda)}</MontoExentoOtraMoneda>`);
    if (o.hasTotalITBISOtraMoneda && invoiceData.totalItbisOtraMoneda != null) f.push(`<TotalITBISOtraMoneda>${fmtMoney(invoiceData.totalItbisOtraMoneda)}</TotalITBISOtraMoneda>`);
    if (o.hasTotalITBIS1OtraMoneda && invoiceData.totalItbis1OtraMoneda != null) f.push(`<TotalITBIS1OtraMoneda>${fmtMoney(invoiceData.totalItbis1OtraMoneda)}</TotalITBIS1OtraMoneda>`);
    if (o.hasTotalITBIS2OtraMoneda && invoiceData.totalItbis2OtraMoneda != null) f.push(`<TotalITBIS2OtraMoneda>${fmtMoney(invoiceData.totalItbis2OtraMoneda)}</TotalITBIS2OtraMoneda>`);
    if (o.hasTotalITBIS3OtraMoneda && invoiceData.totalItbis3OtraMoneda != null) f.push(`<TotalITBIS3OtraMoneda>${fmtMoney(invoiceData.totalItbis3OtraMoneda)}</TotalITBIS3OtraMoneda>`);
    if (o.hasMontoImpuestoAdicionalOtraMoneda && invoiceData.montoImpuestoAdicionalOtraMoneda != null) f.push(`<MontoImpuestoAdicionalOtraMoneda>${fmtMoney(invoiceData.montoImpuestoAdicionalOtraMoneda)}</MontoImpuestoAdicionalOtraMoneda>`);

    // Impuestos adicionales otra moneda (tabla)
    if (o.hasImpuestosAdicionalesOtraMoneda && Array.isArray(invoiceData.impuestosAdicionalesOtraMoneda) && invoiceData.impuestosAdicionalesOtraMoneda.length > 0) {
        f.push(`
      <ImpuestosAdicionalesOtraMoneda>
        ${invoiceData.impuestosAdicionalesOtraMoneda.slice(0, 20).map(it => `
        <ImpuestoAdicionalOtraMoneda>
          <TipoImpuestoOtraMoneda>${esc(String(it.codigo))}</TipoImpuestoOtraMoneda>
          ${it.tasa != null ? `<TasaImpuestoAdicionalOtraMoneda>${Number(it.tasa)}</TasaImpuestoAdicionalOtraMoneda>` : ''}
          ${it.iscEspecifico != null ? `<MontoImpuestoSelectivoConsumoEspecificoOtraMoneda>${fmtMoney(it.iscEspecifico)}</MontoImpuestoSelectivoConsumoEspecificoOtraMoneda>` : ''}
          ${it.iscAdvalorem != null ? `<MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda>${fmtMoney(it.iscAdvalorem)}</MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda>` : ''}
          ${it.otros != null ? `<OtrosImpuestosAdicionalesOtraMoneda>${fmtMoney(it.otros)}</OtrosImpuestosAdicionalesOtraMoneda>` : ''}
        </ImpuestoAdicionalOtraMoneda>`).join('')}
      </ImpuestosAdicionalesOtraMoneda>`);
    }

    if (o.hasMontoTotalOtraMoneda && invoiceData.montoTotalOtraMoneda != null) f.push(`<MontoTotalOtraMoneda>${fmtMoney(invoiceData.montoTotalOtraMoneda)}</MontoTotalOtraMoneda>`);

    if (f.length === 0) return '';
    return `
    <OtraMoneda>
      ${f.join('\n      ')}
    </OtraMoneda>`;
}

function buildItems(computed, profile, invoiceData) {
    const { lines } = computed;
    const ip = profile.items;

    return `
  <DetallesItems>
    ${lines.map((line, index) => {
        const lineNumber = line.lineNumber || (index + 1);
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const recargo = Number(line.recargo || 0);

        // ✅ FIX: MontoItem=0 para tipo 34 con corrección de texto (CodigoModificacion=2)
        let montoItem = (quantity * unitPrice) - discount + recargo;
        if (profile.taxRules.isNota && Number(invoiceData.modificationCode) === 2) {
            montoItem = 0;
        }

        const indicadorFacturacion = getIndicadorFacturacion(line);
        const indicadorBienoServicio = Number(line.indicadorBienoServicio ?? 1);

        const rawItemName = line.itemName ?? line.description ?? 'Item';
        const itemName = String(rawItemName).slice(0, 80);
        const descripcionItem = (line.description && line.description !== itemName) ? String(line.description) : null;

        const hasUnidadMedida = line.unidadMedida != null && Number(line.unidadMedida) >= 1 && Number(line.unidadMedida) <= 62;
        const unidadMedida = hasUnidadMedida ? Number(line.unidadMedida) : null;

        const hasCantRef = line.cantidadReferencia != null;
        const hasUniRef = line.unidadReferencia != null;
        const hasReferencia = hasCantRef && hasUniRef;
        const cantidadReferencia = hasReferencia ? Number(line.cantidadReferencia) : null;
        const unidadReferencia = hasReferencia ? Number(line.unidadReferencia) : null;

        const hasGradosAlcohol = line.gradosAlcohol != null && Number(line.gradosAlcohol) > 0;
        const hasPrecioRef = line.precioUnitarioReferencia != null && Number(line.precioUnitarioReferencia) >= 0;
        const hasFechaElab = !!line.fechaElaboracion;
        const hasFechaVenc = !!line.fechaVencimientoItem;

        // ============================================================
        // 1. TablaCodigosItem (múltiple, hasta 5)
        // ============================================================
        let tabCodigosXml = '';
        if (ip.hasTablaCodigosItem) {
            const codigos = [];

            if (Array.isArray(line.additionalCodes) && line.additionalCodes.length > 0) {
                for (const c of line.additionalCodes.slice(0, ip.codigosItemMax || 5)) {
                    if (c && c.codigoItem) {
                        codigos.push({
                            tipoCodigo: c.tipoCodigo || 'Interna',
                            codigoItem: String(c.codigoItem)
                        });
                    }
                }
            }

            if (line.itemCode && !codigos.some(c => c.codigoItem === line.itemCode)) {
                codigos.unshift({
                    tipoCodigo: 'Interna',
                    codigoItem: String(line.itemCode)
                });
            }

            if (codigos.length > 0) {
                tabCodigosXml = `
      <TablaCodigosItem>
        ${codigos.slice(0, ip.codigosItemMax || 5).map(c => `
        <CodigosItem>
          <TipoCodigo>${esc(c.tipoCodigo)}</TipoCodigo>
          <CodigoItem>${esc(c.codigoItem)}</CodigoItem>
        </CodigosItem>`).join('')}
      </TablaCodigosItem>`;
            }
        }

        // ============================================================
        // 2. Retención (41, 47)
        // ============================================================
        const retencionXml = (ip.hasRetencion && line.retencion)
            ? `
      <Retencion>
        <IndicadorAgenteRetencionoPercepcion>${Number(line.retencion.indicador)}</IndicadorAgenteRetencionoPercepcion>
        ${(ip.hasMontoITBISRetenido && line.retencion.montoItbisRetenido != null) ? `<MontoITBISRetenido>${fmtMoney(line.retencion.montoItbisRetenido)}</MontoITBISRetenido>` : ''}
        ${(ip.hasMontoISRRetenido && line.retencion.montoIsrRetenido != null) ? `<MontoISRRetenido>${fmtMoney(line.retencion.montoIsrRetenido)}</MontoISRRetenido>` : ''}
      </Retencion>` : '';

        // ============================================================
        // 3. TablaSubcantidad (hasta 5)
        // ============================================================
        let tabSubcantidadXml = '';
        if (ip.hasTablaSubcantidad && Array.isArray(line.subcantidades) && line.subcantidades.length > 0) {
            const validSubs = line.subcantidades
                .filter(s => s && s.subcantidad != null && s.codigoSubcantidad != null)
                .slice(0, ip.subcantidadMax || 5);
            if (validSubs.length > 0) {
                tabSubcantidadXml = `
      <TablaSubcantidad>
        ${validSubs.map(s => `
        <SubcantidadItem>
          <Subcantidad>${fmtQuantity(s.subcantidad)}</Subcantidad>
          <CodigoSubcantidad>${Number(s.codigoSubcantidad)}</CodigoSubcantidad>
        </SubcantidadItem>`).join('')}
      </TablaSubcantidad>`;
            }
        }

        // ============================================================
        // 4. DescuentoMonto + TablaSubDescuento (hasta 12)
        // ============================================================
        const descuentoXml = (ip.hasDescuentoMonto && discount > 0) ? `<DescuentoMonto>${fmtMoney(discount)}</DescuentoMonto>` : '';

        let tabSubDescuentoXml = '';
        if (ip.hasTablaSubDescuento && Array.isArray(line.subDescuentos) && line.subDescuentos.length > 0) {
            const validSubs = line.subDescuentos
                .filter(d => d && (d.tipoSubDescuento === '$' || d.tipoSubDescuento === '%') && d.montoSubDescuento != null)
                .slice(0, ip.subDescuentoMax || 12);
            if (validSubs.length > 0) {
                tabSubDescuentoXml = `
      <TablaSubDescuento>
        ${validSubs.map(d => `
        <SubDescuento>
          <TipoSubDescuento>${d.tipoSubDescuento}</TipoSubDescuento>
          ${d.tipoSubDescuento === '%' && d.subDescuentoPorcentaje != null ? `<SubDescuentoPorcentaje>${Number(d.subDescuentoPorcentaje).toFixed(2)}</SubDescuentoPorcentaje>` : ''}
          <MontoSubDescuento>${fmtMoney(d.montoSubDescuento)}</MontoSubDescuento>
        </SubDescuento>`).join('')}
      </TablaSubDescuento>`;
            }
        }

        // ============================================================
        // 5. RecargoMonto + TablaSubRecargo (hasta 12)
        // ============================================================
        const recargoXml = (ip.hasRecargoMonto && recargo > 0) ? `<RecargoMonto>${fmtMoney(recargo)}</RecargoMonto>` : '';

        let tabSubRecargoXml = '';
        if (ip.hasTablaSubRecargo && Array.isArray(line.subRecargos) && line.subRecargos.length > 0) {
            const validSubs = line.subRecargos
                .filter(r => r && (r.tipoSubRecargo === '$' || r.tipoSubRecargo === '%') && r.montoSubRecargo != null)
                .slice(0, ip.subRecargoMax || 12);
            if (validSubs.length > 0) {
                tabSubRecargoXml = `
      <TablaSubRecargo>
        ${validSubs.map(r => `
        <SubRecargo>
          <TipoSubRecargo>${r.tipoSubRecargo}</TipoSubRecargo>
          ${r.tipoSubRecargo === '%' && r.subRecargoPorcentaje != null ? `<SubRecargoPorcentaje>${Number(r.subRecargoPorcentaje).toFixed(2)}</SubRecargoPorcentaje>` : ''}
          <MontoSubRecargo>${fmtMoney(r.montoSubRecargo)}</MontoSubRecargo>
        </SubRecargo>`).join('')}
      </TablaSubRecargo>`;
            }
        }

        // ============================================================
        // 6. TablaImpuestoAdicional (hasta 2)
        // ============================================================
        let tabImpuestoAdicionalXml = '';
        if (ip.hasTablaImpuestoAdicional && Array.isArray(line.impuestosAdicionales) && line.impuestosAdicionales.length > 0) {
            const validTax = line.impuestosAdicionales
                .filter(t => t && t.codigo)
                .slice(0, ip.impuestoAdicionalItemMax || 2);
            if (validTax.length > 0) {
                tabImpuestoAdicionalXml = `
      <TablaImpuestoAdicional>
        ${validTax.map(t => `
        <ImpuestoAdicional>
          <TipoImpuesto>${esc(String(t.codigo))}</TipoImpuesto>
        </ImpuestoAdicional>`).join('')}
      </TablaImpuestoAdicional>`;
            }
        }

        // ============================================================
        // 7. Mineria (21-24)
        // ============================================================
        let mineriaXml = '';
        if (ip.hasMineria) {
            const minFields = [];
            if (ip.hasPesoNetoKilogramo && line.pesoNetoKilogramo != null) minFields.push(`<PesoNetoKilogramo>${fmtMoney(line.pesoNetoKilogramo)}</PesoNetoKilogramo>`);
            if (ip.hasPesoNetoMineria && line.pesoNetoMineria != null) minFields.push(`<PesoNetoMineria>${fmtMoney(line.pesoNetoMineria)}</PesoNetoMineria>`);
            if (ip.hasTipoAfiliacion && line.tipoAfiliacion != null) minFields.push(`<TipoAfiliacion>${Number(line.tipoAfiliacion)}</TipoAfiliacion>`);
            if (ip.hasLiquidacion && line.liquidacion != null) minFields.push(`<Liquidacion>${Number(line.liquidacion)}</Liquidacion>`);

            if (minFields.length > 0) {
                mineriaXml = `
      <Mineria>
        ${minFields.join('\n        ')}
      </Mineria>`;
            }
        }

        // ============================================================
        // 8. OtraMonedaDetalle (35-38)
        // ============================================================
        let otraMonedaDetalleXml = '';
        if (ip.hasOtraMonedaDetalle && invoiceData.tipoMoneda) {
            const omFields = [];
            if (ip.hasPrecioOtraMoneda && line.precioOtraMoneda != null) omFields.push(`<PrecioOtraMoneda>${Number(line.precioOtraMoneda).toFixed(4)}</PrecioOtraMoneda>`);
            if (ip.hasDescuentoOtraMoneda && line.descuentoOtraMoneda != null) omFields.push(`<DescuentoOtraMoneda>${fmtMoney(line.descuentoOtraMoneda)}</DescuentoOtraMoneda>`);
            if (ip.hasRecargoOtraMoneda && line.recargoOtraMoneda != null) omFields.push(`<RecargoOtraMoneda>${fmtMoney(line.recargoOtraMoneda)}</RecargoOtraMoneda>`);
            if (ip.hasMontoItemOtraMoneda && line.montoItemOtraMoneda != null) omFields.push(`<MontoItemOtraMoneda>${fmtMoney(line.montoItemOtraMoneda)}</MontoItemOtraMoneda>`);

            if (omFields.length > 0) {
                otraMonedaDetalleXml = `
      <OtraMonedaDetalle>
        ${omFields.join('\n        ')}
      </OtraMonedaDetalle>`;
            }
        }

        // ============================================================
        // 9. Bloques de referencia, grados alcohol, precio ref, fechas
        // ============================================================
        const referenciaXml = hasReferencia
            ? `<CantidadReferencia>${fmtQuantity(cantidadReferencia)}</CantidadReferencia>
      <UnidadReferencia>${unidadReferencia}</UnidadReferencia>` : '';

        const gradosAlcoholXml = (ip.hasGradosAlcohol && hasGradosAlcohol) ? `<GradosAlcohol>${fmtQuantity(line.gradosAlcohol)}</GradosAlcohol>` : '';
        const precioRefXml = (ip.hasPrecioUnitarioReferencia && hasPrecioRef) ? `<PrecioUnitarioReferencia>${fmtMoney(line.precioUnitarioReferencia)}</PrecioUnitarioReferencia>` : '';
        const fechaElabXml = hasFechaElab ? `<FechaElaboracion>${fmtDate(line.fechaElaboracion)}</FechaElaboracion>` : '';
        const fechaVencXml = hasFechaVenc ? `<FechaVencimientoItem>${fmtDate(line.fechaVencimientoItem)}</FechaVencimientoItem>` : '';

        // ============================================================
        // Ensamblar el <Item> en ORDEN XSD
        // ============================================================
        return `
     <Item>
      <NumeroLinea>${lineNumber}</NumeroLinea>
      ${tabCodigosXml}
      <IndicadorFacturacion>${indicadorFacturacion}</IndicadorFacturacion>
      ${retencionXml}
      <NombreItem>${esc(itemName)}</NombreItem>
      <IndicadorBienoServicio>${indicadorBienoServicio}</IndicadorBienoServicio>
      ${descripcionItem ? `<DescripcionItem>${esc(descripcionItem)}</DescripcionItem>` : ''}
      <CantidadItem>${fmtQuantity(quantity)}</CantidadItem>
      ${unidadMedida !== null ? `<UnidadMedida>${unidadMedida}</UnidadMedida>` : ''}
      ${referenciaXml}
      ${tabSubcantidadXml}
      ${gradosAlcoholXml}
      ${precioRefXml}
      ${fechaElabXml}
      ${fechaVencXml}
      ${mineriaXml}
      <PrecioUnitarioItem>${fmtMoney(unitPrice)}</PrecioUnitarioItem>
      ${descuentoXml}
      ${tabSubDescuentoXml}
      ${recargoXml}
      ${tabSubRecargoXml}
      ${tabImpuestoAdicionalXml}
      ${otraMonedaDetalleXml}
      <MontoItem>${fmtMoney(montoItem)}</MontoItem>
    </Item>`;
    }).join('')}
  </DetallesItems>`;
}

function buildSubtotales(invoiceData, profile) {
    if (!profile.subtotales.present) return '';
    const subtotales = invoiceData.subtotales || [];
    if (subtotales.length === 0) return '';

    return `
    <Subtotales>
      ${subtotales.map(s => `
      <Subtotal>
        <NumeroSubTotal>${s.numeroSubtotal}</NumeroSubTotal>
        ${s.descripcion ? `<DescripcionSubtotal>${esc(s.descripcion)}</DescripcionSubtotal>` : ''}
        ${s.orden != null ? `<Orden>${s.orden}</Orden>` : ''}
        ${s.montoGravadoTotal > 0 ? `<SubTotalMontoGravadoTotal>${fmtMoney(s.montoGravadoTotal)}</SubTotalMontoGravadoTotal>` : ''}
        ${s.montoGravadoI1 > 0 ? `<SubTotalMontoGravadoI1>${fmtMoney(s.montoGravadoI1)}</SubTotalMontoGravadoI1>` : ''}
        ${s.montoGravadoI2 > 0 ? `<SubTotalMontoGravadoI2>${fmtMoney(s.montoGravadoI2)}</SubTotalMontoGravadoI2>` : ''}
        ${s.montoGravadoI3 > 0 ? `<SubTotalMontoGravadoI3>${fmtMoney(s.montoGravadoI3)}</SubTotalMontoGravadoI3>` : ''}
        ${s.subTotalItbis > 0 ? `<SubTotaITBIS>${fmtMoney(s.subTotalItbis)}</SubTotaITBIS>` : ''}
        ${s.subTotalItbis1 > 0 ? `<SubTotaITBIS1>${fmtMoney(s.subTotalItbis1)}</SubTotaITBIS1>` : ''}
        ${s.subTotalItbis2 > 0 ? `<SubTotaITBIS2>${fmtMoney(s.subTotalItbis2)}</SubTotaITBIS2>` : ''}
        ${s.subTotalItbis3 > 0 ? `<SubTotaITBIS3>${fmtMoney(s.subTotalItbis3)}</SubTotaITBIS3>` : ''}
        ${s.subTotalImpuestoAdicional > 0 ? `<SubTotalImpuestoAdicional>${fmtMoney(s.subTotalImpuestoAdicional)}</SubTotalImpuestoAdicional>` : ''}
        ${s.subTotalExento > 0 ? `<SubTotalExento>${fmtMoney(s.subTotalExento)}</SubTotalExento>` : ''}
        ${s.montoSubTotal > 0 ? `<MontoSubTotal>${fmtMoney(s.montoSubTotal)}</MontoSubTotal>` : ''}
        ${s.lineas != null ? `<Lineas>${s.lineas}</Lineas>` : ''}
      </Subtotal>`).join('')}
    </Subtotales>`;
}

function buildDescuentosORecargos(invoiceData, profile) {
    if (!profile.descuentosORecargos.present) return '';
    const lista = invoiceData.descuentosORecargos || [];
    if (lista.length === 0) return '';

    return `
    <DescuentosORecargos>
      ${lista.map(d => `
      <DescuentoORecargo>
        <NumeroLinea>${d.numeroLinea}</NumeroLinea>
        <TipoAjuste>${d.tipoAjuste}</TipoAjuste>
        ${d.indicadorNorma1007 === 1 ? `<IndicadorNorma1007>1</IndicadorNorma1007>` : ''}
        ${d.descripcion ? `<DescripcionDescuentooRecargo>${esc(d.descripcion)}</DescripcionDescuentooRecargo>` : ''}
        <TipoValor>${d.tipoValor}</TipoValor>
        ${d.tipoValor === '%' && d.valor != null ? `<ValorDescuentooRecargo>${Number(d.valor).toFixed(2)}</ValorDescuentooRecargo>` : ''}
        <MontoDescuentooRecargo>${fmtMoney(d.monto)}</MontoDescuentooRecargo>
        ${d.montoOtraMoneda != null ? `<MontoDescuentooRecargoOtraMoneda>${fmtMoney(d.montoOtraMoneda)}</MontoDescuentooRecargoOtraMoneda>` : ''}
        <IndicadorFacturacionDescuentooRecargo>${d.indicadorFacturacion}</IndicadorFacturacionDescuentooRecargo>
      </DescuentoORecargo>`).join('')}
    </DescuentosORecargos>`;
}

function buildPaginacion(invoiceData, profile) {
    if (!profile.paginacion.present) return '';
    if (!invoiceData.totalPaginas || invoiceData.totalPaginas <= 1) return '';
    const paginas = invoiceData.paginas || [];
    if (paginas.length === 0) return '';

    return `
    <Paginacion>
      ${paginas.map(p => `
      <Pagina>
        <PaginaNo>${p.paginaNo}</PaginaNo>
        <NoLineaDesde>${p.noLineaDesde}</NoLineaDesde>
        <NoLineaHasta>${p.noLineaHasta}</NoLineaHasta>
        ${p.subtotalMontoGravadoPagina > 0 ? `<SubtotalMontoGravadoPagina>${fmtMoney(p.subtotalMontoGravadoPagina)}</SubtotalMontoGravadoPagina>` : ''}
        ${p.subtotalMontoGravado1Pagina > 0 ? `<SubtotalMontoGravado1Pagina>${fmtMoney(p.subtotalMontoGravado1Pagina)}</SubtotalMontoGravado1Pagina>` : ''}
        ${p.subtotalMontoGravado2Pagina > 0 ? `<SubtotalMontoGravado2Pagina>${fmtMoney(p.subtotalMontoGravado2Pagina)}</SubtotalMontoGravado2Pagina>` : ''}
        ${p.subtotalMontoGravado3Pagina > 0 ? `<SubtotalMontoGravado3Pagina>${fmtMoney(p.subtotalMontoGravado3Pagina)}</SubtotalMontoGravado3Pagina>` : ''}
        ${p.subtotalExentoPagina > 0 ? `<SubtotalExentoPagina>${fmtMoney(p.subtotalExentoPagina)}</SubtotalExentoPagina>` : ''}
        ${p.subtotalItbisPagina > 0 ? `<SubtotalItbisPagina>${fmtMoney(p.subtotalItbisPagina)}</SubtotalItbisPagina>` : ''}
        ${p.subtotalItbis1Pagina > 0 ? `<SubtotalItbis1Pagina>${fmtMoney(p.subtotalItbis1Pagina)}</SubtotalItbis1Pagina>` : ''}
        ${p.subtotalItbis2Pagina > 0 ? `<SubtotalItbis2Pagina>${fmtMoney(p.subtotalItbis2Pagina)}</SubtotalItbis2Pagina>` : ''}
        ${p.subtotalItbis3Pagina > 0 ? `<SubtotalItbis3Pagina>${fmtMoney(p.subtotalItbis3Pagina)}</SubtotalItbis3Pagina>` : ''}
        ${p.subtotalImpuestoAdicionalPagina > 0 ? `<SubtotalImpuestoAdicionalPagina>${fmtMoney(p.subtotalImpuestoAdicionalPagina)}</SubtotalImpuestoAdicionalPagina>` : ''}
        ${p.subtotalIscEspecificoPagina > 0 ? `<SubtotalImpuestoSelectivoConsumoEspecificoPagina>${fmtMoney(p.subtotalIscEspecificoPagina)}</SubtotalImpuestoSelectivoConsumoEspecificoPagina>` : ''}
        ${p.subtotalOtrosImpuestosPagina > 0 ? `<SubtotalOtrosImpuesto>${fmtMoney(p.subtotalOtrosImpuestosPagina)}</SubtotalOtrosImpuesto>` : ''}
        <MontoSubtotalPagina>${fmtMoney(p.montoSubtotalPagina)}</MontoSubtotalPagina>
        ${p.subtotalMontoNoFacturablePagina > 0 ? `<SubtotalMontoNoFacturablePagina>${fmtMoney(p.subtotalMontoNoFacturablePagina)}</SubtotalMontoNoFacturablePagina>` : ''}
      </Pagina>`).join('')}
    </Paginacion>`;
}

function buildInformacionReferencia(invoiceData, profile) {
    if (!profile.informacionReferencia.present) return '';

    const { modifiedNcf, modifiedNcfIssuerRnc, modifiedNcfDate, modificationCode, modificationReason } = invoiceData;

    if (!modifiedNcf) {
        if (profile.informacionReferencia.required) {
            throw new Error(`Tipo ${profile.code}: InformacionReferencia.NCFModificado es obligatorio`);
        }
        return '';
    }

    return `
    <InformacionReferencia>
      <NCFModificado>${esc(modifiedNcf)}</NCFModificado>
      ${modifiedNcfIssuerRnc ? `<RNCOtroContribuyente>${esc(modifiedNcfIssuerRnc)}</RNCOtroContribuyente>` : ''}
      <FechaNCFModificado>${fmtDate(modifiedNcfDate)}</FechaNCFModificado>
      <CodigoModificacion>${modificationCode}</CodigoModificacion>
      ${(profile.informacionReferencia.hasRazonModificacion && modificationReason) ? `<RazonModificacion>${esc(modificationReason)}</RazonModificacion>` : ''}
    </InformacionReferencia>`;
}

function buildFechaHoraFirma(invoiceData, profile) {
    if (!profile.fechaHoraFirma.present) return '';
    return `
    <FechaHoraFirma>${fmtDateTime(new Date())}</FechaHoraFirma>`;
}

// ------------------------------------------------------------
// ORQUESTADOR
// ------------------------------------------------------------

function buildECFBody(invoiceData, options) {
    const type = String(options.type);
    const profile = getTypeProfile(type);

    validateForType(invoiceData, profile);

    const computed = computeTotals(invoiceData);

    const encabezado = `
  <Encabezado>
    <Version>${profile.encabezado.version || '1.0'}</Version>
    ${buildIdDoc(invoiceData, profile)}
    ${buildEmisor(invoiceData, profile)}
    ${buildComprador(invoiceData, profile)}
    ${buildInformacionesAdicionales(invoiceData, profile)}
    ${buildTransporte(invoiceData, profile)}
    ${buildTotales(computed, invoiceData, profile)}
    ${buildOtraMoneda(invoiceData, profile)}
  </Encabezado>`;

    const detalles = buildItems(computed, profile, invoiceData);
    const subtotales = buildSubtotales(invoiceData, profile);
    const descuentos = buildDescuentosORecargos(invoiceData, profile);
    const paginacion = buildPaginacion(invoiceData, profile);
    const infoRef = buildInformacionReferencia(invoiceData, profile);
    const fechaHora = buildFechaHoraFirma(invoiceData, profile);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECF>${encabezado}${detalles}${subtotales}${descuentos}${paginacion}${infoRef}${fechaHora}
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

    // Require perezoso
    const libxml = require('libxmljs2');  // o libxmljs5

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

    // Require perezoso: solo se necesita si se va a validar contra XSD
    let libxml;
    try {
        libxml = require('libxmljs2');
    } catch (e) {
        try {
            libxml = require('libxmljs5');
        } catch (e2) {
            return {
                valid: false,
                errors: [
                    'libxmljs2/libxmljs5 no está instalado. ' +
                    'La validación XSD está deshabilitada en este entorno. ' +
                    'Instala uno de los dos paquetes para habilitarla.'
                ]
            };
        }
    }

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
    clearXSDCache,
    _validateForType: validateForType,
};