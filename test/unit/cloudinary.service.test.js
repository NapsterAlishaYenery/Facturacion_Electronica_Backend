// test/unit/cloudinary.service.test.js
const path = require('path');

// ------------------------------------------------------------
// Mock de cloudinary ANTES de requerir el servicio
// ------------------------------------------------------------
const cloudinaryPath = require.resolve('../../src/config/cloudinary');

// Estado mutable del mock
const mockState = {
    uploadResult: null,
    uploadError: null,
    destroyResult: null,
    destroyError: null,
    lastUploadOptions: null,
    lastUploadSource: null,
    lastDestroyArgs: null
};

const mockCloudinary = {
    uploader: {
        upload: async (source, options) => {
            mockState.lastUploadSource = source;
            mockState.lastUploadOptions = options;
            if (mockState.uploadError) throw mockState.uploadError;
            return mockState.uploadResult;
        },
        upload_stream: (options, callback) => {
            mockState.lastUploadOptions = options;
            return {
                end: (buffer) => {
                    mockState.lastUploadSource = buffer;
                    if (mockState.uploadError) {
                        setImmediate(() => callback(mockState.uploadError));
                    } else {
                        setImmediate(() => callback(null, mockState.uploadResult));
                    }
                }
            };
        },
        destroy: async (publicId, options) => {
            mockState.lastDestroyArgs = { publicId, options };
            if (mockState.destroyError) throw mockState.destroyError;
            return mockState.destroyResult;
        }
    },
    url: (publicId, options) => `https://res.cloudinary.com/demo/${publicId}?opts=${JSON.stringify(options)}`
};

// Inyectar el mock en el cache
require.cache[cloudinaryPath] = {
    id: cloudinaryPath,
    filename: cloudinaryPath,
    loaded: true,
    exports: mockCloudinary
};

// Ahora sí, requerir el servicio (ya verá el mock)
const cloudinaryService = require('../../src/shared/services/cloudinary.service');

// ------------------------------------------------------------
// Test harness
// ------------------------------------------------------------
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

function resetMock() {
    mockState.uploadResult = null;
    mockState.uploadError = null;
    mockState.destroyResult = null;
    mockState.destroyError = null;
    mockState.lastUploadOptions = null;
    mockState.lastUploadSource = null;
    mockState.lastDestroyArgs = null;
}

// Cloudinary mock result base
function mockUploadResponse(overrides = {}) {
    return {
        public_id: 'ExpediFact/logos/company-1/invoice',
        url: 'http://res.cloudinary.com/demo/image/upload/v1/logo.png',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/logo.png',
        format: 'png',
        resource_type: 'image',
        width: 600,
        height: 400,
        bytes: 12345,
        duration: null,
        ...overrides
    };
}

// ------------------------------------------------------------
// Tests: upload con Buffer
// ------------------------------------------------------------
async function run() {
    console.log('=== TESTS: cloudinary.service.upload (Buffer) ===\n');

    resetMock();
    mockState.uploadResult = mockUploadResponse();
    const buf = Buffer.from('fake-png-bytes');

    const result1 = await cloudinaryService.upload(buf, {
        folder: 'ExpediFact/logos/company-1'
    });

    test('devuelve publicId', result1.publicId === 'ExpediFact/logos/company-1/invoice');
    test('devuelve url', typeof result1.url === 'string' && result1.url.startsWith('http://'));
    test('devuelve secureUrl', typeof result1.secureUrl === 'string' && result1.secureUrl.startsWith('https://'));
    test('devuelve format', result1.format === 'png');
    test('devuelve resourceType', result1.resourceType === 'image');
    test('devuelve width', result1.width === 600);
    test('devuelve height', result1.height === 400);
    test('devuelve bytes', result1.bytes === 12345);
    test('devuelve duration null', result1.duration === null);
    test('pasa folder a Cloudinary', mockState.lastUploadOptions.folder === 'ExpediFact/logos/company-1');
    test('no sobrescribe si no hay publicId', mockState.lastUploadOptions.overwrite === false);
    test('genera filename único si no hay publicId', mockState.lastUploadOptions.unique_filename === true);

    // ---- con publicId (sobrescribir) ----
    resetMock();
    mockState.uploadResult = mockUploadResponse();

    await cloudinaryService.upload(buf, {
        folder: 'ExpediFact/logos/company-1',
        publicId: 'invoice',
        transformation: [{ width: 600, height: 600, crop: 'limit' }]
    });

    test('sobrescribe si hay publicId', mockState.lastUploadOptions.overwrite === true);
    test('usa publicId', mockState.lastUploadOptions.public_id === 'invoice');
    test('invalida CDN si sobrescribe', mockState.lastUploadOptions.invalidate === true);
    test('pasa transformation', Array.isArray(mockState.lastUploadOptions.transformation));

    // ---- error ----
    resetMock();
    mockState.uploadError = new Error('network down');

    let caught = null;
    try {
        await cloudinaryService.upload(buf, { folder: 'x' });
    } catch (err) { caught = err; }

    test('lanza error en fallo de upload', caught !== null);
    test('error incluye mensaje de Cloudinary', caught && caught.message.includes('network down'));

    // ---- folder faltante ----
    let folderErr = null;
    try {
        await cloudinaryService.upload(buf, {});
    } catch (err) { folderErr = err; }
    test('lanza error si falta folder', folderErr !== null && folderErr.message.includes('folder'));

    // ---- source inválido ----
    let sourceErr = null;
    try {
        await cloudinaryService.upload(12345, { folder: 'x' });
    } catch (err) { sourceErr = err; }
    test('lanza error si source no es Buffer ni string', sourceErr !== null);

    // ------------------------------------------------------------
    // Tests: upload con ruta de archivo
    // ------------------------------------------------------------
    console.log('\n=== TESTS: cloudinary.service.upload (filePath) ===\n');

    resetMock();
    mockState.uploadResult = mockUploadResponse();

    await cloudinaryService.upload('/tmp/some-file.png', {
        folder: 'ExpediFact/logos/company-1'
    });

    test('detecta source string como filePath', mockState.lastUploadSource === '/tmp/some-file.png');

    // ------------------------------------------------------------
    // Tests: remove
    // ------------------------------------------------------------
    console.log('\n=== TESTS: cloudinary.service.remove ===\n');

    resetMock();
    mockState.destroyResult = { result: 'ok' };

    const del1 = await cloudinaryService.remove('ExpediFact/logos/company-1/invoice');
    test('devuelve result ok', del1.result === 'ok');
    test('pasa publicId correcto', mockState.lastDestroyArgs.publicId === 'ExpediFact/logos/company-1/invoice');
    test('pasa resource_type image por defecto', mockState.lastDestroyArgs.options.resource_type === 'image');
    test('invalida CDN', mockState.lastDestroyArgs.options.invalidate === true);

    // ---- custom resource_type ----
    resetMock();
    mockState.destroyResult = { result: 'ok' };
    await cloudinaryService.remove('vid-1', 'video');
    test('respeta resource_type custom', mockState.lastDestroyArgs.options.resource_type === 'video');

    // ---- error ----
    resetMock();
    mockState.destroyError = new Error('not found');
    let delErr = null;
    try { await cloudinaryService.remove('x'); } catch (e) { delErr = e; }
    test('lanza error en fallo de delete', delErr !== null);

    // ---- publicId faltante ----
    let noIdErr = null;
    try { await cloudinaryService.remove(); } catch (e) { noIdErr = e; }
    test('lanza error si falta publicId', noIdErr !== null);

    // ------------------------------------------------------------
    // Tests: buildUrl
    // ------------------------------------------------------------
    console.log('\n=== TESTS: cloudinary.service.buildUrl ===\n');

    const url1 = cloudinaryService.buildUrl('ExpediFact/logos/company-1/invoice');
    test('buildUrl devuelve string', typeof url1 === 'string');
    test('buildUrl incluye secure', url1.includes('"secure":true') || url1.includes('secure'));

    const url2 = cloudinaryService.buildUrl('ExpediFact/logos/c/invoice', [{ width: 200 }]);
    test('buildUrl acepta transformation', typeof url2 === 'string');

    let urlErr = null;
    try { cloudinaryService.buildUrl(); } catch (e) { urlErr = e; }
    test('buildUrl lanza error si falta publicId', urlErr !== null);

    // ------------------------------------------------------------
    // Tests: safeUnlink
    // ------------------------------------------------------------
    console.log('\n=== TESTS: cloudinary.service.safeUnlink ===\n');

    // No lanza si el path no existe
    let unlinkErr = null;
    try {
        await cloudinaryService.safeUnlink('/tmp/definitely-not-exists-xyz.txt');
    } catch (e) { unlinkErr = e; }
    test('safeUnlink no lanza si no existe', unlinkErr === null);

    // No lanza con null/undefined
    let unlinkNullErr = null;
    try {
        await cloudinaryService.safeUnlink(null);
        await cloudinaryService.safeUnlink(undefined);
    } catch (e) { unlinkNullErr = e; }
    test('safeUnlink no lanza con null/undefined', unlinkNullErr === null);

    // ------------------------------------------------------------
    // RESULTADO
    // ------------------------------------------------------------
    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});