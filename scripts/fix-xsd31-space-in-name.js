// scripts/fix-xsd31-space-in-name.js
const fs = require('fs');
const path = require('path');

const xsdPath = path.resolve(
  process.cwd(),
  'docs/dgii/xsd/ecf31/e-CF 31 v.1.0.xsd'
);

if (!fs.existsSync(xsdPath)) {
  console.error('❌ No existe:', xsdPath);
  process.exit(1);
}

let content = fs.readFileSync(xsdPath, 'utf8');

// Quitar BOM si existe
content = content.replace(/^\uFEFF/, '');

// Buscar el simpleType con espacio al inicio del name
// Patrón: name=" IndicadorServicioTodoIncluidoType"
const badPattern = /name="\s+IndicadorServicioTodoIncluidoType"/;

if (!badPattern.test(content)) {
  if (content.includes('name="IndicadorServicioTodoIncluidoType"')) {
    console.log('⏭️  Ya está corregido (sin espacio). Nada que hacer.');
    process.exit(0);
  }
  console.error('❌ No se encontró el patrón a corregir.');
  process.exit(1);
}

// Reemplazar solo el espacio inicial del name
const originalMatches = content.match(badPattern);
console.log('🔍 Encontrado:', originalMatches[0]);

content = content.replace(
  badPattern,
  'name="IndicadorServicioTodoIncluidoType"'
);

fs.writeFileSync(xsdPath, content, 'utf8');
console.log('✅ Espacio eliminado en IndicadorServicioTodoIncluidoType');