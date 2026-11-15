// ============================================================
// Módulo de firma: orquestador
// ============================================================
const { loadCompanyCertificate } = require('./certificate-loader');
const {
    signXml,
    setFechaHoraFirma,
    formatDgiDate,
    extractSecurityCodeFromSignedXml,
    isXmlSigned,
    prettyPrintSignature
} = require('./xml-signer');

/**
 * Firma un XML de e-CF o RFCE.
 *
 * @param {string} xmlUnsigned - XML sin <Signature>
 * @param {Object} company - instancia de Company con cert
 * @returns {Promise<{
 *   xmlSigned: string,
 *   fechaHoraFirma: string|null,
 *   securityCode: string,
 *   signedAt: Date,
 *   isRfce: boolean
 * }>}
 */
async function signInvoiceXml(xmlUnsigned, company) {
    if (!xmlUnsigned || typeof xmlUnsigned !== 'string') {
        throw new Error('signInvoiceXml: xmlUnsigned is required');
    }

    if (isXmlSigned(xmlUnsigned)) {
        throw new Error('XML is already signed');
    }

    // Detectar si es ECF o RFCE
    const isRfce = /<RFCE[\s>]/.test(xmlUnsigned);

    // 1. Descifrar certificado
    const { privateKeyPem, certificatePem } = await loadCompanyCertificate(company);

    // 2. Setear FechaHoraFirma SOLO si es ECF
    const signedAt = new Date();
    const fechaHoraFirma = formatDgiDate(signedAt);

    let xmlToSign = xmlUnsigned;
    if (!isRfce) {
        // Solo el e-CF lleva <FechaHoraFirma>
        xmlToSign = setFechaHoraFirma(xmlUnsigned, fechaHoraFirma);
    }
    // El RFCE ya viene con <CodigoSeguridadeCF> seteado por buildRFCE()

    // 3. Firmar
    const xmlSignedRaw = signXml(xmlToSign, { privateKeyPem, certificatePem });

    // 3.1. Formatear el <Signature> para que se vea igual que DGII
    // (opcional pero recomendado para auditoría / presentación)
    const xmlSigned = prettyPrintSignature(xmlSignedRaw);

    // 4. Extraer código de seguridad
    const securityCode = extractSecurityCodeFromSignedXml(xmlSigned);

    return {
        xmlSigned,
        fechaHoraFirma: isRfce ? null : fechaHoraFirma,
        securityCode,
        signedAt,
        isRfce
    };
}

module.exports = {
    signInvoiceXml,
    loadCompanyCertificate,
    // Re-export helpers por si los necesitas en tests
    signXml,
    setFechaHoraFirma,
    formatDgiDate,
    extractSecurityCodeFromSignedXml,
    isXmlSigned
};