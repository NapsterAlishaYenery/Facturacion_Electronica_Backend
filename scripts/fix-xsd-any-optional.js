// scripts/fix-xsd-any-optional.js
//
// ⚠️ NOTA: Este script modifica los XSD de la DGII temporalmente
// para que el <xs:any> final (donde va la firma digital XMLDSig)
// sea OPCIONAL. Es necesario MIENTRAS no tengamos el certificado.
//
// CUANDO YA TENGAMOS EL CERTIFICADO:
//   1. Dejar de correr este script.
//   2. Restaurar los XSD originales desde el ZIP de la DGII.
//   3. El <xs:any> volverá a minOccurs="1" y la firma lo llenará.
//
const fs = require('fs');
const path = require('path');

const files = [
  'docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd',
  'docs/dgii/xsd/ecf32/e-CF 32 v.1.0.xsd',
  'docs/dgii/xsd/ecf33/e-CF 33 v.1.0.xsd',   // ← agregado
  'docs/dgii/xsd/ecf34/e-CF 34 v.1.0.xsd',   // ← agregado
];

for (const f of files) {
  const full = path.resolve(process.cwd(), f);
  if (!fs.existsSync(full)) {
    console.log(`⏭️  ${f}: no existe, skip`);
    continue;
  }
  let content = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  const before = content;

  // Cubre ambas variantes del <xs:any>:
  // - <xs:any minOccurs="1" maxOccurs="1" processContents="skip"/>
  // - <xs:any processContents="skip" minOccurs="1" maxOccurs="1" />
  content = content.replace(
    /<xs:any\s+(?:minOccurs="1"\s+maxOccurs="1"\s+processContents="skip"|processContents="skip"\s+minOccurs="1"\s+maxOccurs="1")\s*\/>/g,
    '<xs:any processContents="skip" minOccurs="0" maxOccurs="1" />'
  );

  if (content !== before) {
    fs.writeFileSync(full, content, 'utf8');
    console.log(`✅ ${f}: xs:any ahora es minOccurs="0"`);
  } else {
    console.log(`⏭️  ${f}: sin cambios (ya estaba o patrón no encontrado)`);
  }
}