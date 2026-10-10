// ============================================================
// Cifrado AES-256-GCM para certificados digitales
// Requisito de seguridad DGII (PSFE)
// ============================================================

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;         // 96 bits, recomendado para GCM
const AUTH_TAG_LENGTH = 16;   // 128 bits

// ------------------------------------------------------------
// Cargar y validar CERT_MASTER_KEY (fail-fast al arrancar)
// ------------------------------------------------------------
const MASTER_KEY_HEX = process.env.CERT_MASTER_KEY;

if (!MASTER_KEY_HEX) {
    throw new Error(
        'CERT_MASTER_KEY is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

if (!/^[0-9a-fA-F]{64}$/.test(MASTER_KEY_HEX)) {
    throw new Error(
        'CERT_MASTER_KEY must be exactly 64 hex characters (32 bytes). ' +
        `Got ${MASTER_KEY_HEX.length} characters.`
    );
}

const MASTER_KEY_BYTES = Buffer.from(MASTER_KEY_HEX, 'hex'); // 32 bytes

// ------------------------------------------------------------
// Cifrar un Buffer → { encrypted, iv, authTag }
// ------------------------------------------------------------
function encryptBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('encryptBuffer expects a Buffer');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, MASTER_KEY_BYTES, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
}

// ------------------------------------------------------------
// Descifrar un Buffer → Buffer
// ------------------------------------------------------------
function decryptBuffer(encrypted, iv, authTag) {
    if (!Buffer.isBuffer(encrypted) || !Buffer.isBuffer(iv) || !Buffer.isBuffer(authTag)) {
        throw new Error('decryptBuffer expects Buffers for encrypted, iv and authTag');
    }
    if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid IV length: ${iv.length}, expected ${IV_LENGTH}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error(`Invalid auth tag length: ${authTag.length}, expected ${AUTH_TAG_LENGTH}`);
    }

    const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY_BYTES, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ------------------------------------------------------------
// Cifrar un string → "iv:authTag:encrypted" (todo en base64)
// ------------------------------------------------------------
function encryptString(str) {
    if (typeof str !== 'string') {
        throw new Error('encryptString expects a string');
    }

    const { encrypted, iv, authTag } = encryptBuffer(Buffer.from(str, 'utf8'));

    return [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted.toString('base64')
    ].join(':');
}

// ------------------------------------------------------------
// Descifrar "iv:authTag:encrypted" → string
// ------------------------------------------------------------
function decryptString(combined) {
    if (typeof combined !== 'string') {
        throw new Error('decryptString expects a string');
    }

    const parts = combined.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted string format. Expected "iv:authTag:encrypted"');
    }

    const [ivB64, tagB64, encB64] = parts;

    const decrypted = decryptBuffer(
        Buffer.from(encB64, 'base64'),
        Buffer.from(ivB64, 'base64'),
        Buffer.from(tagB64, 'base64')
    );

    return decrypted.toString('utf8');
}

module.exports = {
    MASTER_KEY_BYTES,
    encryptBuffer,
    decryptBuffer,
    encryptString,
    decryptString
};