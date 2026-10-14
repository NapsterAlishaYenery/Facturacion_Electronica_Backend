// test-xsd.js
//
// Valida el XML más reciente contra el XSD oficial de la DGII.
// Detecta el tipo automáticamente desde el NCF.
//
// Uso:
//   node test-xsd.js                       → valida el último XML de Expedinap
//   node test-xsd.js <companyId>           → valida el último XML de otra empresa
//   node test-xsd.js <companyId> <ncf>     → valida un NCF específico

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { validateAgainstXSD } = require('./src/modules/invoices/ecf/xml-generator');

const DEFAULT_COMPANY_ID = 'fb187614-0412-4d82-ae96-283a0394ae84';

// ------------------------------------------------------------
// CLI args
// ------------------------------------------------------------
const companyId = process.argv[2] || DEFAULT_COMPANY_ID;
const targetNcf = process.argv[3] || null;

// ------------------------------------------------------------
// Encontrar el XML más reciente (o el NCF específico)
// ------------------------------------------------------------
function findLatestXML(cid) {
    const basePath = path.join('uploads', 'xml', cid);
    if (!fs.existsSync(basePath)) return null;

    const xmls = [];

    const years = fs.readdirSync(basePath)
        .filter(f => fs.statSync(path.join(basePath, f)).isDirectory());

    for (const year of years) {
        const yearPath = path.join(basePath, year);
        const months = fs.readdirSync(yearPath)
            .filter(f => fs.statSync(path.join(yearPath, f)).isDirectory());

        for (const month of months) {
            const monthPath = path.join(yearPath, month);
            const files = fs.readdirSync(monthPath)
                .filter(f => f.endsWith('.xml') && !f.endsWith('.signed.xml'));

            for (const file of files) {
                const fullPath = path.join(monthPath, file);
                xmls.push({
                    path: fullPath,
                    mtime: fs.statSync(fullPath).mtime,
                    ncf: file.replace('.xml', '')
                });
            }
        }
    }

    if (xmls.length === 0) return null;
    xmls.sort((a, b) => b.mtime - a.mtime);
    return xmls[0];
}

function findXMLByNcf(cid, ncf) {
    const basePath = path.join('uploads', 'xml', cid);
    if (!fs.existsSync(basePath)) return null;

    const years = fs.readdirSync(basePath)
        .filter(f => fs.statSync(path.join(basePath, f)).isDirectory());

    for (const year of years) {
        const yearPath = path.join(basePath, year);
        const months = fs.readdirSync(yearPath)
            .filter(f => fs.statSync(path.join(yearPath, f)).isDirectory());

        for (const month of months) {
            const fullPath = path.join(yearPath, month, `${ncf}.xml`);
            if (fs.existsSync(fullPath)) {
                return { path: fullPath, ncf };
            }
        }
    }
    return null;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
const target = targetNcf
    ? findXMLByNcf(companyId, targetNcf)
    : findLatestXML(companyId);

if (!target) {
    console.error(`❌ No se encontró ningún XML para companyId=${companyId}`);
    if (targetNcf) console.error(`   NCF buscado: ${targetNcf}`);
    process.exit(1);
}

const xml = fs.readFileSync(target.path, 'utf8');

// Detectar tipo desde el NCF (E + tipo + 10 dígitos)
const typeFromNcf = target.ncf.substring(1, 3);

console.log('═══════════════════════════════════════════════════');
console.log('  VALIDACIÓN CONTRA XSD OFICIAL DE LA DGII');
console.log('═══════════════════════════════════════════════════');
console.log(`  Archivo: ${target.path}`);
console.log(`  NCF:     ${target.ncf}`);
console.log(`  Tipo:    ${typeFromNcf}`);
console.log(`  Bytes:   ${xml.length}`);
console.log('───────────────────────────────────────────────────\n');

const result = validateAgainstXSD(xml, typeFromNcf);

if (result.valid) {
    console.log('✅ XML VÁLIDO contra el XSD oficial de la DGII\n');
    process.exit(0);
} else {
    console.log(`❌ XML INVÁLIDO — ${result.errors.length} error(es):\n`);
    result.errors.slice(0, 20).forEach((e, i) => {
        console.log(`   ${i + 1}. ${e}`);
    });
    if (result.errors.length > 20) {
        console.log(`\n   ... y ${result.errors.length - 20} errores más`);
    }
    console.log('');
    process.exit(1);
}