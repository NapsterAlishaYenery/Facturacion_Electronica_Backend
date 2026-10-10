// ============================================================
// Generador de certificados .p12 de prueba (solo para tests)
// Usa node-forge para crear un PKCS#12 self-signed en memoria
// ============================================================

const forge = require('node-forge');

/**
 * Genera un .p12 de prueba con el RNC embebido en el CN.
 * @param {Object} options
 * @param {string} options.rnc           - RNC que irá en el CN (ej: '131234567')
 * @param {string} options.password      - Contraseña del .p12
 * @param {number} options.daysValid     - Días de validez (default 365)
 * @param {boolean} options.expired      - Si true, genera cert ya vencido
 * @returns {{ buffer: Buffer, password: string, rnc: string, expiresAt: Date }}
 */
function generateTestP12({
    rnc = '131234567',
    password = 'test123',
    daysValid = 365,
    expired = false
} = {}) {
    // 1. Generar par de llaves RSA 2048
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // 2. Crear certificado X.509
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(8));

    // Fechas de validez
    const now = new Date();
    const notBefore = expired
        ? new Date(now.getTime() - (daysValid + 30) * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 60 * 60 * 1000); // hace 1 hora
    const notAfter = expired
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000) // ayer
        : new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000);

    cert.validity.notBefore = notBefore;
    cert.validity.notAfter = notAfter;

    // 3. Subject / Issuer (self-signed)
    const attrs = [
        { name: 'commonName', value: rnc },
        { name: 'organizationName', value: 'Test Company' },
        { name: 'countryName', value: 'DO' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // 4. Firmar con su propia llave (self-signed)
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 5. Empaquetar en PKCS#12
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        keys.privateKey,
        [cert],
        password,
        { algorithm: '3des' } // 3des es lo que usan la mayoría de navegadores/tools
    );
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const buffer = Buffer.from(p12Der, 'binary');

    return {
        buffer,
        password,
        rnc,
        expiresAt: notAfter
    };
}

module.exports = { generateTestP12 };