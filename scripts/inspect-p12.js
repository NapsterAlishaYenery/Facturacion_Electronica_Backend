// ============================================================
// Diagnóstico de un .p12: muestra los certificados, sus
// atributos de Subject, el RNC extraído y el certificado del
// titular que se elegiría.
//
// Uso:
//   node scripts/inspect-p12.js "ruta.p12" "password" [expectedRnc]
// ============================================================
const fs = require('fs');
const forge = require('node-forge');
const {
    extractAllCertsFromP12,
    extractRncFromCert,
    pickOwnerCert,
    normalizeRnc,
    isSelfSigned
} = require('../src/shared/utils/certificate.util');

const [, , p12Path, password, expectedRnc] = process.argv;

if (!p12Path || !password) {
    console.error('Uso: node scripts/inspect-p12.js <p12> <password> [expectedRnc]');
    process.exit(1);
}

const buffer = fs.readFileSync(p12Path);

let p12;
try {
    p12 = forge.pkcs12.pkcs12FromAsn1(
        forge.asn1.fromDer(buffer.toString('binary')),
        password
    );
} catch (e) {
    console.error('❌ No se pudo abrir el .p12:', e.message);
    process.exit(1);
}

const all = extractAllCertsFromP12(p12);

console.log(`\n=== ${all.length} CERTIFICADO(S) EN EL .p12 ===\n`);

all.forEach((cert, i) => {
    const rnc = extractRncFromCert(cert);

    console.log(`--- Cert #${i} ---`);
    console.log(`  Subject attrs:`);
    (cert.subject.attributes || []).forEach(a => {
        const label = a.shortName || a.name || a.type || '?';
        console.log(`    ${label} = ${JSON.stringify(a.value)}`);
    });

    console.log(`  Issuer attrs:`);
    (cert.issuer.attributes || []).forEach(a => {
        const label = a.shortName || a.name || a.type || '?';
        console.log(`    ${label} = ${JSON.stringify(a.value)}`);
    });

    console.log(`  self-signed?  : ${isSelfSigned(cert)}`);
    console.log(`  RNC extraído  : ${rnc ? `${rnc.rnc}  (source: ${rnc.source})` : 'NO ENCONTRADO'}`);
    console.log(`  Validity      : ${cert.validity.notBefore.toISOString()} → ${cert.validity.notAfter.toISOString()}`);
    console.log('');
});

const owner = pickOwnerCert(all, expectedRnc);
const ownerRnc = extractRncFromCert(owner);

console.log('=== CERTIFICADO DEL TITULAR (elegido) ===');
if (!owner) {
    console.log('  ❌ No se encontró un certificado de titular');
    process.exit(1);
}

const cn = owner.subject.attributes.find(a =>
    a.shortName === 'CN' || a.name === 'CN'
)?.value;

const sn = owner.subject.attributes.find(a =>
    a.shortName === 'serialNumber' || a.name === 'serialNumber'
)?.value;

console.log(`  CN           : ${cn || '(no tiene)'}`);
console.log(`  serialNumber : ${sn || '(no tiene)'}`);
console.log(`  RNC          : ${ownerRnc ? ownerRnc.rnc : 'NO ENCONTRADO'}`);
console.log(`  Normalizado  : ${normalizeRnc(ownerRnc?.rnc)}`);
console.log(`  Expira       : ${owner.validity.notAfter.toISOString()}`);
console.log(`  Días rest.   : ${Math.ceil((owner.validity.notAfter - Date.now()) / 86400000)}`);
console.log('');

if (expectedRnc) {
    const ok = normalizeRnc(ownerRnc?.rnc) === normalizeRnc(expectedRnc);
    console.log(`=== MATCH CON EMPRESA ===`);
    console.log(`  Esperado : ${normalizeRnc(expectedRnc)}`);
    console.log(`  Obtenido : ${normalizeRnc(ownerRnc?.rnc)}`);
    console.log(`  ¿Coincide?: ${ok ? '✅ SÍ' : '❌ NO'}`);
}