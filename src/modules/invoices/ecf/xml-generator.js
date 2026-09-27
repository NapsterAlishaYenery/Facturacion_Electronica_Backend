// ============================================================
// Generador de XML para e-CF (Comprobantes Fiscales Electrónicos)
// Este módulo es invocado por invoices.service.js
// NO es un módulo HTTP. NO tiene rutas ni controladores.
// ============================================================

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
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const formatDateTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    };

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
        `FechaEmision=${encodeURIComponent(formatDate(issuedAt))}`,
        `MontoTotal=${encodeURIComponent(formattedTotal)}`,
        `FechaFirma=${encodeURIComponent(formatDateTime(signedAt))}`,
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

module.exports = {
    escapeXMLSpecialChars,
    removeEmptyTags,
    buildQRCodeData,
    extractSecurityCode
};