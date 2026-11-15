// ============================================================
// Utilidades para extraer datos de certificados .p12 (PKCS#12)
// Soporta cadenas de certificados (titular + intermedios + CA raíz)
// ============================================================
const forge = require('node-forge');

// ------------------------------------------------------------
// Devuelve TODOS los certificados X.509 dentro del .p12
// ------------------------------------------------------------
function extractAllCertsFromP12(p12Asn1) {
    const certBags = p12Asn1.getBags({ bagType: forge.pki.oids.certBag });
    const bags = certBags[forge.pki.oids.certBag] || [];
    return bags.map(b => b.cert).filter(Boolean);
}

// ------------------------------------------------------------
// ¿El certificado es self-signed (CA raíz)?
// Comparar Subject y Issuer por sus atributos clave.
// ------------------------------------------------------------
function isSelfSigned(cert) {
    const subj = cert.subject.attributes
        .map(a => `${a.shortName || a.name}=${a.value}`)
        .sort()
        .join('|');
    const iss = cert.issuer.attributes
        .map(a => `${a.shortName || a.name}=${a.value}`)
        .sort()
        .join('|');
    return subj === iss;
}

// ------------------------------------------------------------
// Extrae el RNC (9 u 11 dígitos) de un certificado.
// Busca en serialNumber, CN, OU, O, emailAddress, UID y SAN.
// Devuelve { rnc, source } o null.
// ------------------------------------------------------------
// ------------------------------------------------------------
// Extrae el RNC (9 u 11 dígitos) de un certificado.
// Recorre TODOS los atributos del subject para no depender del
// shortName que use cada AC (Viafirma, Cámara, etc.).
// ------------------------------------------------------------
function extractRncFromCert(cert) {
    if (!cert || !cert.subject) return null;

    const tryValue = (label, raw) => {
        if (!raw) return null;
        const m = String(raw).match(/(\d{9,11})/);
        return m ? { rnc: m[1], source: `${label}: ${raw}` } : null;
    };

    // 1. Recorrer TODOS los atributos del subject (solución robusta)
    //    Prioridad: serialNumber > CN > OU > O > UID > emailAddress > resto
    const PRIORITY = ['serialNumber', 'CN', 'OU', 'O', 'UID', 'emailAddress'];
    const attrs = cert.subject.attributes || [];

    // Primero los campos con prioridad
    for (const fieldName of PRIORITY) {
        const attr = attrs.find(a =>
            a.shortName === fieldName ||
            a.name === fieldName ||
            a.type === fieldName
        );
        if (!attr) continue;
        const hit = tryValue(attr.shortName || attr.name || attr.type, attr.value);
        if (hit) return hit;
    }

    // Fallback: cualquier atributo del subject
    for (const attr of attrs) {
        if (PRIORITY.includes(attr.shortName) || PRIORITY.includes(attr.name)) continue;
        const hit = tryValue(attr.shortName || attr.name || attr.type || '?', attr.value);
        if (hit) return hit;
    }

    // 2. subjectAltName
    const san = cert.getExtension('subjectAltName');
    if (san && Array.isArray(san.altNames)) {
        for (const alt of san.altNames) {
            const hit = tryValue(`SAN(${alt.type})`, alt.value);
            if (hit) return hit;
        }
    }

    return null;
}

// ------------------------------------------------------------
// Elige el certificado del titular (NO un CA intermedio/raíz).
//
// Estrategia:
//   1. Si hay varios, descartar los self-signed (CA raíz).
//   2. De los restantes, preferir el que tenga un RNC.
//   3. Si hay varios con RNC, preferir el que coincida con expectedRnc.
//   4. Fallback: el primero no self-signed.
// ------------------------------------------------------------
function pickOwnerCert(certs, expectedRnc = null) {
    if (!certs || certs.length === 0) return null;
    if (certs.length === 1) return certs[0];

    // 1. Descartar self-signed
    const nonSelfSigned = certs.filter(c => !isSelfSigned(c));
    const candidates = nonSelfSigned.length > 0 ? nonSelfSigned : certs;

    // 2. Preferir con RNC
    const withRnc = candidates
        .map(c => ({ cert: c, rnc: extractRncFromCert(c) }))
        .filter(x => x.rnc);

    // 3. Coincidencia exacta con expectedRnc
    if (expectedRnc) {
        const normalized = String(expectedRnc).replace(/\D/g, '');
        const exact = withRnc.find(x => x.rnc.rnc === normalized);
        if (exact) return exact.cert;
    }

    // 4. Cualquiera con RNC
    if (withRnc.length > 0) return withRnc[0].cert;

    // 5. Fallback
    return candidates[0];
}

// ------------------------------------------------------------
// Normaliza un RNC: solo dígitos, máximo 11
// ------------------------------------------------------------
function normalizeRnc(rnc) {
    if (!rnc) return '';
    return String(rnc).replace(/\D/g, '').slice(0, 11);
}

module.exports = {
    extractAllCertsFromP12,
    extractRncFromCert,
    pickOwnerCert,
    normalizeRnc,
    isSelfSigned
};