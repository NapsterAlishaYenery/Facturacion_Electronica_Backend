// ============================================================
// Storage de PDF en disco
//
// Cachea los PDFs generados por formato.
// Estructura: uploads/pdf/{companyId}/{year}/{month}/{ncf}.pdf           (a4)
//             uploads/pdf/{companyId}/{year}/{month}/{ncf}.ticket.pdf    (ticket)
//             uploads/pdf/{companyId}/{year}/{month}/{ncf}.half.pdf      (half)
// ============================================================

const fs = require('fs').promises;
const path = require('path');

// ------- helpers -------

function getBasePath() {
    return process.env.UPLOADS_PDF_PATH || 'uploads/pdf';
}

// ------------------------------------------------------------
// Sufijo por formato. A4 no lleva sufijo (default).
// ------------------------------------------------------------
function getFormatSuffix(format) {
    if (format === 'ticket') return '.ticket';
    if (format === 'half') return '.half';
    return '';
}

function buildPDFPath(invoice, format = 'a4') {
    const basePath = getBasePath();
    const issuedDate = new Date(invoice.issuedAt);
    const year = issuedDate.getUTCFullYear();
    const month = String(issuedDate.getUTCMonth() + 1).padStart(2, '0');
    const suffix = getFormatSuffix(format);

    return path.join(
        basePath,
        String(invoice.companyId),
        String(year),
        month,
        `${invoice.ncf}${suffix}.pdf`
    );
}

async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

// ------- module functions -------

async function savePDFToDisk(invoice, pdfBuffer, format = 'a4') {
    if (!pdfBuffer) {
        throw new Error('savePDFToDisk: pdfBuffer is required');
    }

    const fullPath = buildPDFPath(invoice, format);
    await ensureDirectory(path.dirname(fullPath));
    await fs.writeFile(fullPath, pdfBuffer);

    return fullPath;
}

async function readPDFFromDisk(invoice, format = 'a4') {
    try {
        const fullPath = buildPDFPath(invoice, format);
        return await fs.readFile(fullPath);
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
    }
}

async function pdfExists(invoice, format = 'a4') {
    try {
        const fullPath = buildPDFPath(invoice, format);
        await fs.access(fullPath);
        return true;
    } catch {
        return false;
    }
}

async function deletePDFFromDisk(invoice, format = 'a4') {
    try {
        const fullPath = buildPDFPath(invoice, format);
        await fs.unlink(fullPath);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') return false;
        throw err;
    }
}

module.exports = {
    buildPDFPath,
    savePDFToDisk,
    readPDFFromDisk,
    pdfExists,
    deletePDFFromDisk
};