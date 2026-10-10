// ============================================================
// Tests unitarios para src/shared/utils/crypto.js
// ============================================================
require('dotenv').config();
const cryptoUtil = require('../../src/shared/utils/crypto');

let passed = 0;
let failed = 0;

function assert(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

function assertThrows(label, fn, expectedMessagePart = '') {
    try {
        fn();
        console.log(`  ❌ ${label} (no lanzó error)`);
        failed++;
    } catch (err) {
        const ok = expectedMessagePart === '' || err.message.includes(expectedMessagePart);
        if (ok) {
            console.log(`  ✅ ${label}`);
            passed++;
        } else {
            console.log(`  ❌ ${label} (mensaje inesperado: ${err.message})`);
            failed++;
        }
    }
}

console.log('\n=== crypto.test.js ===\n');

// ------------------------------------------------------------
// encryptBuffer / decryptBuffer
// ------------------------------------------------------------
console.log('--- encryptBuffer / decryptBuffer ---');

{
    const original = Buffer.from('contenido secreto del p12');
    const { encrypted, iv, authTag } = cryptoUtil.encryptBuffer(original);

    assert('encrypted es Buffer', Buffer.isBuffer(encrypted));
    assert('iv es Buffer de 12 bytes', Buffer.isBuffer(iv) && iv.length === 12);
    assert('authTag es Buffer de 16 bytes', Buffer.isBuffer(authTag) && authTag.length === 16);
    assert('encrypted !== original', !encrypted.equals(original));

    const decrypted = cryptoUtil.decryptBuffer(encrypted, iv, authTag);
    assert('decrypted equals original', decrypted.equals(original));
}

{
    // Dos cifrados del mismo buffer deben producir ivs distintos
    const original = Buffer.from('mismo contenido');
    const a = cryptoUtil.encryptBuffer(original);
    const b = cryptoUtil.encryptBuffer(original);

    assert('dos cifrados → ivs distintos', !a.iv.equals(b.iv));
    assert('dos cifrados → ciphertexts distintos', !a.encrypted.equals(b.encrypted));
}

{
    // Tampering → debe fallar
    const original = Buffer.from('datos importantes');
    const { encrypted, iv, authTag } = cryptoUtil.encryptBuffer(original);

    // Modificar un byte del ciphertext
    const tampered = Buffer.from(encrypted);
    tampered[0] = tampered[0] ^ 0xff;

    assertThrows('tampering en ciphertext → throw', () => {
        cryptoUtil.decryptBuffer(tampered, iv, authTag);
    });

    // Modificar un byte del authTag
    const badTag = Buffer.from(authTag);
    badTag[0] = badTag[0] ^ 0xff;

    assertThrows('tampering en authTag → throw', () => {
        cryptoUtil.decryptBuffer(encrypted, iv, badTag);
    });
}

// ------------------------------------------------------------
// encryptString / decryptString
// ------------------------------------------------------------
console.log('\n--- encryptString / decryptString ---');

{
    const original = 'mi-password-super-secreta';
    const combined = cryptoUtil.encryptString(original);

    assert('combined es string', typeof combined === 'string');
    assert('combined tiene 3 partes (:)', combined.split(':').length === 3);

    const decrypted = cryptoUtil.decryptString(combined);
    assert('decrypted equals original', decrypted === original);
}

{
    // Password con caracteres especiales y UTF-8
    const original = 'p@$$w0rd-ñ-áéíóú-中文-🔐';
    const combined = cryptoUtil.encryptString(original);
    const decrypted = cryptoUtil.decryptString(combined);

    assert('soporta UTF-8 y emojis', decrypted === original);
}

{
    const combined = cryptoUtil.encryptString('algo');
    assertThrows('string mal formado → throw', () => {
        cryptoUtil.decryptString('no-tiene-formato-correcto');
    });
}

{
    const a = cryptoUtil.encryptString('misma-password');
    const b = cryptoUtil.encryptString('misma-password');

    assert('dos cifrados de misma string → outputs distintos', a !== b);
}

// ------------------------------------------------------------
// Validaciones de entrada
// ------------------------------------------------------------
console.log('\n--- Validaciones de entrada ---');

assertThrows('encryptBuffer(null) → throw', () => cryptoUtil.encryptBuffer(null));
assertThrows('encryptBuffer("string") → throw', () => cryptoUtil.encryptBuffer('string'));
assertThrows('encryptString(123) → throw', () => cryptoUtil.encryptString(123));
assertThrows('decryptString(null) → throw', () => cryptoUtil.decryptString(null));

// ------------------------------------------------------------
// MASTER_KEY_BYTES
// ------------------------------------------------------------
console.log('\n--- MASTER_KEY_BYTES ---');
assert('MASTER_KEY_BYTES es Buffer de 32 bytes',
    Buffer.isBuffer(cryptoUtil.MASTER_KEY_BYTES) && cryptoUtil.MASTER_KEY_BYTES.length === 32);

// ------------------------------------------------------------
// Resumen
// ------------------------------------------------------------
console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);