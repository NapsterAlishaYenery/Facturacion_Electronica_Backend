// ============================================================
// XML Signer
// Firma un XML con RSA-SHA256 + C14N + enveloped-signature
// (compatible con DGII, XMLDSig 1.0)
// ============================================================
const { SignedXml } = require('xml-crypto');
const { AppError } = require('../../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Formatea la fecha en formato DGII: DD-MM-YYYY HH:mm:ss (hora RD)
// ------------------------------------------------------------
function formatDgiDate(date = new Date()) {
    const d = new Date(date);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const get = (t) => parts.find(p => p.type === t)?.value || '00';
    return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// ------------------------------------------------------------
// Reemplaza <FechaHoraFirma>...</FechaHoraFirma> por fechaString.
// Si NO existe el tag, lo inserta justo antes de </ECF>.
// ------------------------------------------------------------
function setFechaHoraFirma(xml, fechaString) {
    if (!xml || typeof xml !== 'string') {
        throw new AppError('setFechaHoraFirma: xml is required', 400, 'INVALID_XML');
    }
    if (!fechaString) {
        throw new AppError('setFechaHoraFirma: fechaString is required', 400, 'INVALID_FECHA');
    }

    const tagRegex = /<FechaHoraFirma\s*\/>|<FechaHoraFirma>.*?<\/FechaHoraFirma>/;

    if (tagRegex.test(xml)) {
        return xml.replace(
            tagRegex,
            `<FechaHoraFirma>${fechaString}</FechaHoraFirma>`
        );
    }

    // Si no existe, insertarlo antes de </ECF>
    if (!/<\/ECF>\s*$/.test(xml)) {
        throw new AppError(
            'setFechaHoraFirma: cannot locate </ECF> to insert <FechaHoraFirma>',
            500,
            'INVALID_XML_STRUCTURE'
        );
    }

    return xml.replace(
        /<\/ECF>\s*$/,
        `    <FechaHoraFirma>${fechaString}</FechaHoraFirma>\n</ECF>`
    );
}

// ------------------------------------------------------------
// Firma un XML sin <Signature>.
// Añade <Signature> al final del elemento raíz <ECF> o <RFCE>.
//
// @param {string} xmlString - XML sin firma, con FechaHoraFirma seteado.
// @param {Object} options - { privateKeyPem, certificatePem }
// @returns {string} XML firmado
// ------------------------------------------------------------
function signXml(xmlString, { privateKeyPem, certificatePem }) {
    if (!xmlString || typeof xmlString !== 'string') {
        throw new AppError('signXml: xmlString is required', 400, 'INVALID_XML');
    }
    if (!privateKeyPem || !certificatePem) {
        throw new AppError(
            'signXml: privateKeyPem and certificatePem are required',
            500,
            'CERTIFICATE_MISSING'
        );
    }

    // Detectar raíz: ECF o RFCE
    const rootMatch = xmlString.match(/<([A-Za-z][A-Za-z0-9]*)[\s>]/);
    if (!rootMatch) {
        throw new AppError('signXml: cannot detect root element', 500, 'INVALID_XML_STRUCTURE');
    }
    const rootName = rootMatch[1];

    const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        idMode: 'off'  // ⚠️ CRÍTICO: evita que xml-crypto agregue Id="_0" al ECF
    });

    sig.addReference({
        xpath: `/*[local-name(.)="${rootName}"]`,   // ← /* en lugar de //*
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
        uri: '',                                     // ← URI="" (forzado)
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
        ]
    });

    try {
        sig.computeSignature(xmlString, {
            location: {
                reference: `//*[local-name(.)="${rootName}"]`,
                action: 'append'
            }
        });
    } catch (err) {
        throw new AppError(
            `Failed to sign XML: ${err.message}`,
            500,
            'XML_SIGN_FAILED'
        );
    }

    // ⚠️ xml-crypto@6: computeSignature() YA NO devuelve el string.
    // Se obtiene con getSignedXml().
    const signed = sig.getSignedXml();

    if (!signed || typeof signed !== 'string' || signed.length === 0) {
        throw new AppError(
            'xml-crypto returned empty signed XML',
            500,
            'XML_SIGN_FAILED'
        );
    }

    return signed;
}

// ------------------------------------------------------------
// Extrae los primeros 6 chars del <SignatureValue> (código DGII).
// ------------------------------------------------------------
function extractSecurityCodeFromSignedXml(signedXml) {
    if (!signedXml || typeof signedXml !== 'string') return '';
    const m = signedXml.match(/<SignatureValue[^>]*>([A-Za-z0-9+/=\s]+)<\/SignatureValue>/);
    if (!m) return '';
    const clean = m[1].replace(/\s+/g, '');
    return clean.substring(0, 6);
}

// ------------------------------------------------------------
// Detecta si un XML ya tiene <Signature>.
// ------------------------------------------------------------
function isXmlSigned(xml) {
    return typeof xml === 'string'
        && /<Signature[\s>]/.test(xml)
        && /<\/Signature>/.test(xml);
}


/**
 * Pretty-print del bloque <Signature> para que se vea igual que el de la
 * herramienta oficial de la DGII: con saltos de línea entre tags estructurales
 * y base64 en una sola línea.
 *
 * ⚠️ IMPORTANTE: solo lo hacemos para visualización. La firma digital se
 * calculó ANTES de este formateo, por lo que el <SignatureValue> y el
 * <X509Certificate> NO se deben tocar.
 *
 * El formateo agrega saltos de línea entre los tags estructurales del
 * <Signature>, pero no agrega espacios en blanco entre el contenido de
 * los tags, por lo que el hash del XML no cambia desde el punto de vista
 * semántico. DGII parsea el XML y recalcula el hash sobre el XML parseado,
 * por lo que acepta el XML formateado sin problemas.
 */
function prettyPrintSignature(signedXml) {
    if (!signedXml || typeof signedXml !== 'string') return signedXml;

    return signedXml.replace(
        /<Signature([\s\S]*?)<\/Signature>/,
        (fullMatch) => {
            // Extraer el atributo xmlns del <Signature>
            const sigOpenTag = fullMatch.match(/^<Signature([^>]*)>/)?.[1] || '';

            // Extraer contenido interno
            let inner = fullMatch
                .replace(/^<Signature[^>]*>/, '')
                .replace(/<\/Signature>$/, '');

            // Preservar base64 (SignatureValue y X509Certificate)
            const sigValue = inner.match(/<SignatureValue>([\s\S]*?)<\/SignatureValue>/)?.[1] || '';
            const x509Cert = inner.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/)?.[1] || '';

            // Marcadores temporales para no romper con los saltos de línea
            let work = inner
                .replace(/<SignatureValue>[\s\S]*?<\/SignatureValue>/, '@@SIGVALUE@@')
                .replace(/<X509Certificate>[\s\S]*?<\/X509Certificate>/, '@@X509CERT@@');

            // Insertar saltos entre tags estructurales
            work = work
                .replace(/>\s*</g, '>\n<')
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');

            // Restaurar base64 (en una sola línea)
            work = work
                .replace('@@SIGVALUE@@', `<SignatureValue>${sigValue}</SignatureValue>`)
                .replace('@@X509CERT@@', `<X509Certificate>${x509Cert}</X509Certificate>`);

            return `<Signature${sigOpenTag}>\n${work}\n</Signature>`;
        }
    );
}


module.exports = {
    signXml,
    setFechaHoraFirma,
    formatDgiDate,
    extractSecurityCodeFromSignedXml,
    isXmlSigned,
    prettyPrintSignature
};