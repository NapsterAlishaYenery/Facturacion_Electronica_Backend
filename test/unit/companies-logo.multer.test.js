    // ============================================================
// Test unitario del multer de logos
// Verifica configuración, fileFilter y normalización de errores
// sin tocar HTTP ni disco.
// ============================================================

const path = require('path');
const multer = require('multer');
const { AppError } = require('../../src/shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Mock de multer para capturar la configuración
// ------------------------------------------------------------
const multerPath = require.resolve('multer');

const mockState = {
    capturedConfig: null,
    capturedFieldName: null,
    // Comportamiento del .single() devuelto
    nextCallArg: undefined
};

const realMulter = require('multer');

function mockMulterFactory(config) {
    mockState.capturedConfig = config;
    return {
        single: (fieldName) => {
            mockState.capturedFieldName = fieldName;
            // Middleware que simula el comportamiento de multer:
            // llama next() con el error que el test configure, o sin error.
            return (req, res, next) => {
                if (mockState.nextCallArg !== undefined) {
                    return next(mockState.nextCallArg);
                }
                next();
            };
        }
    };
}

// Conservar MulterError real para los tests de normalización
mockMulterFactory.MulterError = realMulter.MulterError;
mockMulterFactory.memoryStorage = realMulter.memoryStorage;
mockMulterFactory.diskStorage = realMulter.diskStorage;

// Inyectar mock en cache
require.cache[multerPath] = {
    id: multerPath,
    filename: multerPath,
    loaded: true,
    exports: mockMulterFactory
};

// Ahora requerir el módulo (verá el mock)
const { uploadLogo, MAX_SIZE_BYTES, ALLOWED_MIMETYPES } = require(
    '../../src/modules/companies/companies.logo.multer'
);

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
    mockState.nextCallArg = undefined;
}

// Ejecuta el middleware uploadLogo y devuelve lo que pasó a next()
function runMiddleware() {
    return new Promise((resolve) => {
        const req = {};
        const res = {};
        uploadLogo(req, res, (err) => resolve(err));
    });
}

async function run() {
    // ------------------------------------------------------------
    // Tests: configuración del multer
    // ------------------------------------------------------------
    console.log('=== TESTS: configuración del multer ===\n');

    test('multer fue llamado', mockState.capturedConfig !== null);
    test('storage es memoryStorage',
        mockState.capturedConfig.storage instanceof multer.memoryStorage().constructor);
    test('límite de tamaño es 2MB',
        mockState.capturedConfig.limits.fileSize === 2 * 1024 * 1024);
    test('límite de archivos es 1',
        mockState.capturedConfig.limits.files === 1);
    test('fileFilter está definido',
        typeof mockState.capturedConfig.fileFilter === 'function');
    test('campo del form-data es "logo"',
        mockState.capturedFieldName === 'logo');

    // ------------------------------------------------------------
    // Tests: constantes exportadas
    // ------------------------------------------------------------
    console.log('\n=== TESTS: constantes exportadas ===\n');

    test('MAX_SIZE_BYTES es 2MB', MAX_SIZE_BYTES === 2 * 1024 * 1024);
    test('ALLOWED_MIMETYPES tiene 4 entradas', ALLOWED_MIMETYPES.length === 4);
    test('ALLOWED_MIMETYPES incluye png',
        ALLOWED_MIMETYPES.includes('image/png'));
    test('ALLOWED_MIMETYPES incluye jpeg',
        ALLOWED_MIMETYPES.includes('image/jpeg'));
    test('ALLOWED_MIMETYPES incluye svg',
        ALLOWED_MIMETYPES.includes('image/svg+xml'));
    test('ALLOWED_MIMETYPES incluye webp',
        ALLOWED_MIMETYPES.includes('image/webp'));
    test('ALLOWED_MIMETYPES NO incluye gif',
        !ALLOWED_MIMETYPES.includes('image/gif'));

    // ------------------------------------------------------------
    // Tests: fileFilter
    // ------------------------------------------------------------
    console.log('\n=== TESTS: fileFilter ===\n');

    const filter = mockState.capturedConfig.fileFilter;

    // Caso válido: png
    await new Promise((resolve) => {
        filter({}, { mimetype: 'image/png' }, (err, accept) => {
            test('png aceptado', err === null && accept === true);
            resolve();
        });
    });

    // Caso válido: svg
    await new Promise((resolve) => {
        filter({}, { mimetype: 'image/svg+xml' }, (err, accept) => {
            test('svg aceptado', err === null && accept === true);
            resolve();
        });
    });

    // Caso inválido: gif
    await new Promise((resolve) => {
        filter({}, { mimetype: 'image/gif' }, (err, accept) => {
            test('gif rechazado', err instanceof AppError);
            test('gif → statusCode 400', err?.statusCode === 400);
            test('gif → code LOGO_INVALID_MIMETYPE', err?.code === 'LOGO_INVALID_MIMETYPE');
            resolve();
        });
    });

    // Caso inválido: pdf
    await new Promise((resolve) => {
        filter({}, { mimetype: 'application/pdf' }, (err, accept) => {
            test('pdf rechazado', err instanceof AppError);
            resolve();
        });
    });

    // Caso inválido: octet-stream (a diferencia del .p12, NO se acepta)
    await new Promise((resolve) => {
        filter({}, { mimetype: 'application/octet-stream' }, (err, accept) => {
            test('octet-stream rechazado', err instanceof AppError);
            resolve();
        });
    });

    // ------------------------------------------------------------
    // Tests: wrapper normaliza MulterError
    // ------------------------------------------------------------
    console.log('\n=== TESTS: normalización de MulterError ===\n');

    // LIMIT_FILE_SIZE → AppError 400 LOGO_FILE_TOO_LARGE
    resetMock();
    mockState.nextCallArg = new multer.MulterError('LIMIT_FILE_SIZE');
    let err1 = await runMiddleware();
    test('LIMIT_FILE_SIZE → AppError', err1 instanceof AppError);
    test('LIMIT_FILE_SIZE → statusCode 400', err1?.statusCode === 400);
    test('LIMIT_FILE_SIZE → code LOGO_FILE_TOO_LARGE',
        err1?.code === 'LOGO_FILE_TOO_LARGE');
    test('LIMIT_FILE_SIZE → mensaje menciona 2MB',
        err1?.message?.includes('2MB'));

    // LIMIT_FILE_COUNT
    resetMock();
    mockState.nextCallArg = new multer.MulterError('LIMIT_FILE_COUNT');
    let err2 = await runMiddleware();
    test('LIMIT_FILE_COUNT → code LOGO_TOO_MANY_FILES',
        err2?.code === 'LOGO_TOO_MANY_FILES');

    // LIMIT_UNEXPECTED_FILE
    resetMock();
    mockState.nextCallArg = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    let err3 = await runMiddleware();
    test('LIMIT_UNEXPECTED_FILE → code LOGO_UNEXPECTED_FIELD',
        err3?.code === 'LOGO_UNEXPECTED_FIELD');

    // ------------------------------------------------------------
    // Tests: wrapper respeta AppError del fileFilter
    // ------------------------------------------------------------
    console.log('\n=== TESTS: wrapper respeta AppError ===\n');

    resetMock();
    const filterErr = new AppError('bad type', 400, 'LOGO_INVALID_MIMETYPE');
    mockState.nextCallArg = filterErr;
    let err4 = await runMiddleware();
    test('AppError del fileFilter pasa tal cual', err4 === filterErr);
    test('AppError conserva su code',
        err4?.code === 'LOGO_INVALID_MIMETYPE');

    // ------------------------------------------------------------
    // Tests: camino feliz
    // ------------------------------------------------------------
    console.log('\n=== TESTS: camino feliz ===\n');

    resetMock();
    let errHappy = await runMiddleware();
    test('sin error → next() sin argumento', errHappy === undefined);

    // ------------------------------------------------------------
    // RESULTADO
    // ------------------------------------------------------------
    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});