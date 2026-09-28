// scripts/fix-xsd-any-optional.js
const fs = require('fs');
const path = require('path');

const files = [
  'docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd',
  'docs/dgii/xsd/ecf32/e-CF 32 v.1.0.xsd',
];

for (const f of files) {
  const full = path.resolve(process.cwd(), f);
  let content = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  const before = content;

  content = content.replace(
    /<xs:any\s+processContents="skip"\s+minOccurs="1"\s+maxOccurs="1"\s*\/>/g,
    '<xs:any processContents="skip" minOccurs="0" maxOccurs="1" />'
  );

  if (content !== before) {
    fs.writeFileSync(full, content, 'utf8');
    console.log(`✅ ${f}: xs:any ahora es minOccurs="0"`);
  } else {
    console.log(`⏭️  ${f}: sin cambios (ya estaba o patrón no encontrado)`);
  }
}