// ============================================================
// Storage de XML en disco
//
// Escribe y lee los XMLs generados por xml-integrator.
// La fuente de verdad es la BD (invoices.xml_content).
// El disco es para auditoría (DGII exige 10 años) y descarga.
//
// Estructura:
//   uploads/xml/{companyId}/{year}/{month}/{ncf}.xml
//   uploads/xml/{companyId}/{year}/{month}/{ncf}.signed.xml
// ============================================================

const fs = require('fs').promises;
const path = require('path');

// ------- helpers -------

// ------------------------------------------------------------
// Ruta base configurable por .env (default: uploads/xml)
// ------------------------------------------------------------
function getBasePath() {
    return process.env.UPLOADS_XML_PATH || 'uploads/xml';
}

// ------------------------------------------------------------
// Construye la ruta completa del XML
// ------------------------------------------------------------
function buildXMLPath(invoice, signed = false) {
    const basePath = getBasePath();
    const issuedDate = new Date(invoice.issuedAt);
    const year = issuedDate.getUTCFullYear();
    const month = String(issuedDate.getUTCMonth() + 1).padStart(2, '0');
    const suffix = signed ? '.signed.xml' : '.xml';

    return path.join(
        basePath,
        String(invoice.companyId),
        String(year),
        month,
        `${invoice.ncf}${suffix}`
    );
}

// ------------------------------------------------------------
// Crea directorios recursivamente si no existen
// ------------------------------------------------------------
async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

// ------- module functions -------

// ------------------------------------------------------------
// Escribe el XML unsigned en disco.
// Devuelve la ruta absoluta o lanza error si falla.
// ------------------------------------------------------------
async function saveXMLToDisk(invoice, xmlContent) {
    if (!xmlContent) {
        throw new Error('saveXMLToDisk: xmlContent is required');
    }

    const fullPath = buildXMLPath(invoice, false);
    await ensureDirectory(path.dirname(fullPath));
    await fs.writeFile(fullPath, xmlContent, 'utf8');

    return fullPath;
}

// ------------------------------------------------------------
// Escribe el XML signed en disco.
// Solo se llama desde Fase 9 (después de firmar).
// ------------------------------------------------------------
async function saveSignedXMLToDisk(invoice, xmlSigned) {
    if (!xmlSigned) {
        throw new Error('saveSignedXMLToDisk: xmlSigned is required');
    }

    const fullPath = buildXMLPath(invoice, true);
    await ensureDirectory(path.dirname(fullPath));
    await fs.writeFile(fullPath, xmlSigned, 'utf8');

    return fullPath;
}

// ------------------------------------------------------------
// Lee el XML del disco. Si no existe, retorna null.
// NO lanza si el archivo no está.
// ------------------------------------------------------------
async function readXMLFromDisk(invoice, type = 'unsigned') {
    const signed = type === 'signed';

    try {
        const fullPath = buildXMLPath(invoice, signed);
        return await fs.readFile(fullPath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') return null;   // archivo no existe
        throw err;                                 // otro error (permisos, etc.)
    }
}

// ------------------------------------------------------------
// Verifica si el XML existe en disco.
// ------------------------------------------------------------
async function xmlExists(invoice, signed = false) {
    try {
        const fullPath = buildXMLPath(invoice, signed);
        await fs.access(fullPath);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    buildXMLPath,
    saveXMLToDisk,
    saveSignedXMLToDisk,
    readXMLFromDisk,
    xmlExists
};