// ============================================================
// Certificate Loader
// Descifra el .p12 de la empresa desde disco + BD y extrae
// la clave privada (PEM) y el certificado del titular (PEM).
// ============================================================
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const cryptoUtil = require('../../../shared/utils/crypto');
const {
    extractAllCertsFromP12,
    extractRncFromCert,
    pickOwnerCert,
    normalizeRnc
} = require('../../../shared/utils/certificate.util');
const { AppError } = require('../../../shared/middlewares/error.middleware');

/**
 * Carga el certificado de la empresa.
 * @param {Company} company - instancia de Company
 * @returns {Promise<{privateKeyPem: string, certificatePem: string, cert: object, certRnc: string}>}
 */
async function loadCompanyCertificate(company) {
    if (!company) {
        throw new AppError('Company is required', 400, 'COMPANY_REQUIRED');
    }

    // 1. Verificar que tenga certificado
    if (!company.certificatePath ||
        !company.certificateIv ||
        !company.certificateAuthTag ||
        !company.certificatePasswordEncrypted) {
        throw new AppError(
            'Company has no certificate uploaded. Upload a .p12 first.',
            409,
            'COMPANY_NO_CERTIFICATE'
        );
    }

    // 2. Leer .p12 cifrado del disco
    const uploadDir = process.env.CERT_UPLOAD_DIR || './uploads/certs';
    const filepath = path.join(uploadDir, company.certificatePath);

    if (!fs.existsSync(filepath)) {
        throw new AppError(
            `Certificate file not found on disk: ${company.certificatePath}`,
            500,
            'CERTIFICATE_FILE_MISSING'
        );
    }

    const encrypted = fs.readFileSync(filepath);

    // 3. Descifrar .p12 (AES-256-GCM)
    const iv = Buffer.from(company.certificateIv, 'base64');
    const authTag = Buffer.from(company.certificateAuthTag, 'base64');

    let p12Buffer;
    try {
        p12Buffer = cryptoUtil.decryptBuffer(encrypted, iv, authTag);
    } catch (err) {
        throw new AppError(
            `Failed to decrypt certificate: ${err.message}. CERT_MASTER_KEY may have rotated.`,
            500,
            'CERTIFICATE_DECRYPT_FAILED'
        );
    }

    // 4. Descifrar el password
    const password = cryptoUtil.decryptString(company.certificatePasswordEncrypted);

    // 5. Abrir .p12 con forge
    let p12;
    try {
        p12 = forge.pkcs12.pkcs12FromAsn1(
            forge.asn1.fromDer(p12Buffer.toString('binary')),
            password
        );
    } catch (err) {
        throw new AppError(
            `Failed to open .p12: ${err.message}`,
            500,
            'CERTIFICATE_OPEN_FAILED'
        );
    }

    // 6. Extraer cert del titular
    const allCerts = extractAllCertsFromP12(p12);
    const expectedRnc = normalizeRnc(company.rnc);
    const ownerCert = pickOwnerCert(allCerts, expectedRnc);

    if (!ownerCert) {
        throw new AppError(
            'Could not identify owner certificate in the chain',
            500,
            'CERTIFICATE_NO_OWNER'
        );
    }

    // 7. Extraer clave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];

    if (keyBagList.length === 0) {
        throw new AppError(
            'No private key found in the .p12',
            500,
            'CERTIFICATE_NO_PRIVATE_KEY'
        );
    }

    const privateKey = keyBagList[0].key;

    // 8. Validar expiración
    if (ownerCert.validity.notAfter < new Date()) {
        throw new AppError(
            `Certificate expired on ${ownerCert.validity.notAfter.toISOString()}. Upload a new .p12.`,
            409,
            'CERTIFICATE_EXPIRED'
        );
    }

    return {
        privateKeyPem: forge.pki.privateKeyToPem(privateKey),
        certificatePem: forge.pki.certificateToPem(ownerCert),
        cert: ownerCert,
        certRnc: extractRncFromCert(ownerCert)?.rnc || null
    };
}

module.exports = { loadCompanyCertificate };