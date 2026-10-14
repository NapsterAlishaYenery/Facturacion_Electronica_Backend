// test/unit/xml-storage.test.js
//
// Tests unitarios del xml-storage.
// Usa un directorio temporal en uploads/ para no contaminar.

const fs = require('fs').promises;
const path = require('path');

const {
    buildXMLPath,
    saveXMLToDisk,
    saveSignedXMLToDisk,
    readXMLFromDisk,
    xmlExists
} = require('../../src/modules/documents/storage/xml-storage');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

// ------------------------------------------------------------
// Mock
// ------------------------------------------------------------
const mockInvoice = {
    companyId: 'test-company-0001',
    ncf: 'E310000000999',
    issuedAt: new Date('2026-10-15')
};

const mockXml = '<?xml version="1.0" encoding="UTF-8"?><ECF>test</ECF>';
const mockXmlSigned = '<?xml version="1.0" encoding="UTF-8"?><ECF><Signature>test</Signature></ECF>';

// ------------------------------------------------------------
// Setup: forzar UPLOADS_XML_PATH a un directorio temporal de test
// ------------------------------------------------------------
process.env.UPLOADS_XML_PATH = 'uploads/xml-test';

// ============================================================
// buildXMLPath
// ============================================================
console.log('=== buildXMLPath ===\n');

const unsignedPath = buildXMLPath(mockInvoice, false);
test('path contiene companyId', unsignedPath.includes('test-company-0001'));
test('path contiene year', unsignedPath.includes('2026'));
test('path contiene month', unsignedPath.includes('10'));
test('path termina con ncf.xml', unsignedPath.endsWith('E310000000999.xml'));
const expectedBase = path.normalize('uploads/xml-test');
test('path usa UPLOADS_XML_PATH', unsignedPath.startsWith(expectedBase));

const signedPath = buildXMLPath(mockInvoice, true);
test('signed termina con ncf.signed.xml', signedPath.endsWith('E310000000999.signed.xml'));

// ============================================================
// saveXMLToDisk
// ============================================================
console.log('\n=== saveXMLToDisk ===\n');

(async () => {
    try {
        // --- Test guardar unsigned ---
        const savedPath = await saveXMLToDisk(mockInvoice, mockXml);
        test('saveXMLToDisk devuelve path', typeof savedPath === 'string');
        test('archivo existe tras guardar', await xmlExists(mockInvoice, false));

        // Verificar contenido
        const content = await readXMLFromDisk(mockInvoice, 'unsigned');
        test('contenido coincide con el original', content === mockXml);

        // --- Test guardar signed ---
        await saveSignedXMLToDisk(mockInvoice, mockXmlSigned);
        test('archivo signed existe', await xmlExists(mockInvoice, true));

        const signedContent = await readXMLFromDisk(mockInvoice, 'signed');
        test('contenido signed coincide', signedContent === mockXmlSigned);

        // --- Test error si xmlContent vacío ---
        try {
            await saveXMLToDisk(mockInvoice, null);
            test('saveXMLToDisk(null) lanza error', false, 'should have thrown');
        } catch (err) {
            test('saveXMLToDisk(null) lanza error', err.message.includes('required'));
        }

        // --- Test readXMLFromDisk con archivo inexistente ---
        const missingInvoice = { ...mockInvoice, ncf: 'NO-EXISTE-999' };
        const missingContent = await readXMLFromDisk(missingInvoice, 'unsigned');
        test('readXMLFromDisk devuelve null si no existe', missingContent === null);

        // --- Test xmlExists con archivo inexistente ---
        const missingExists = await xmlExists(missingInvoice, false);
        test('xmlExists devuelve false si no existe', missingExists === false);

        // --- Limpieza ---
        const cleanupPath = path.join(process.cwd(), 'uploads', 'xml-test');
        await fs.rm(cleanupPath, { recursive: true, force: true });
        console.log('\n  🧹 Directorio de test limpiado');

    } catch (err) {
        console.error('❌ Error inesperado:', err.message);
        console.error(err.stack);
        failed++;
    }

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();