// test/unit/company-logo.model.test.js
// Test unitario del modelo CompanyLogo (sin tocar BD real)

const path = require('path');

// ------------------------------------------------------------
// Mock de sequelize.define para capturar el modelo sin BD
// ------------------------------------------------------------
const databasePath = require.resolve('../../src/config/database');

// Estado mutable del mock
let capturedModelName = null;
let capturedAttributes = null;
let capturedOptions = null;

const mockModel = {
    name: 'CompanyLogo',
    attributes: {}
};

const mockSequelize = {
    define: (name, attributes, options) => {
        capturedModelName = name;
        capturedAttributes = attributes;
        capturedOptions = options;

        // Simular propiedades básicas que Sequelize añade
        mockModel.name = name;
        mockModel.attributes = attributes;
        mockModel.options = options;

        // Añadir métodos estáticos que podamos testear
        mockModel.validate = async (instance) => {
            const errors = [];
            for (const [field, config] of Object.entries(attributes)) {
                const value = instance[field];
                const isNull = value === null || value === undefined;

                // allowNull check
                if (!config.allowNull && isNull && config.defaultValue === undefined) {
                    errors.push(`${field} cannot be null`);
                    continue;
                }
                if (isNull) continue;

                // validate.isIn
                if (config.validate?.isIn) {
                    const [allowed] = config.validate.isIn.args;
                    if (!allowed.includes(value)) {
                        errors.push(`${field} must be one of: ${allowed.join(', ')}`);
                    }
                }

                // validate.notEmpty
                if (config.validate?.notEmpty && typeof value === 'string' && value.trim() === '') {
                    errors.push(`${field} cannot be empty`);
                }
            }
            if (errors.length > 0) {
                const err = new Error('Validation error');
                err.errors = errors;
                throw err;
            }
            return true;
        };

        return mockModel;
    }
};

// Inyectar mock en cache
require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: mockSequelize
};

// Ahora requerir el modelo (verá el mock)
const CompanyLogo = require('../../src/models/companyLogo.model');

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

async function run() {
    // ------------------------------------------------------------
    // Tests: definición del modelo
    // ------------------------------------------------------------
    console.log('=== TESTS: definición del modelo ===\n');

    test('nombre del modelo es CompanyLogo', capturedModelName === 'CompanyLogo');
    test('tableName es company_logos', capturedOptions.tableName === 'company_logos');
    test('timestamps true', capturedOptions.timestamps === true);
    test('underscored true', capturedOptions.underscored === true);

    // ------------------------------------------------------------
    // Tests: atributos
    // ------------------------------------------------------------
    console.log('\n=== TESTS: atributos ===\n');

    const attrs = capturedAttributes;

    test('id es UUID PK', attrs.id.type.key === 'UUID' && attrs.id.primaryKey === true);
    test('id tiene defaultValue UUIDV4', attrs.id.defaultValue === 'UUIDV4' || attrs.id.defaultValue?.key === 'UUIDV4' || attrs.id.defaultValue?.toString().includes('UUID'));

    test('companyId es UUID y not null', attrs.companyId.type.key === 'UUID' && attrs.companyId.allowNull === false);
    test('companyId mapea a company_id', attrs.companyId.field === 'company_id');

    test('purpose es STRING(20) not null', attrs.purpose.type.key === 'STRING' && attrs.purpose.allowNull === false);
    test('purpose default invoice', attrs.purpose.defaultValue === 'invoice');
    test('purpose valida isIn', attrs.purpose.validate?.isIn?.args?.[0]?.includes('invoice'));
    test('purpose valida isIn incluye dashboard', attrs.purpose.validate?.isIn?.args?.[0]?.includes('dashboard'));

    test('publicId es STRING(300) not null', attrs.publicId.type.key === 'STRING' && attrs.publicId.allowNull === false);
    test('publicId mapea a public_id', attrs.publicId.field === 'public_id');
    test('publicId valida notEmpty', !!attrs.publicId.validate?.notEmpty);

    test('url es STRING(500) not null', attrs.url.type.key === 'STRING' && attrs.url.allowNull === false);
    test('url valida notEmpty', !!attrs.url.validate?.notEmpty);

    test('secureUrl es STRING(500) not null', attrs.secureUrl.type.key === 'STRING' && attrs.secureUrl.allowNull === false);
    test('secureUrl mapea a secure_url', attrs.secureUrl.field === 'secure_url');
    test('secureUrl valida notEmpty', !!attrs.secureUrl.validate?.notEmpty);

    test('format es STRING(10) nullable', attrs.format.type.key === 'STRING' && attrs.format.allowNull === true);

    test('width es INTEGER default 0', attrs.width.type.key === 'INTEGER' && attrs.width.defaultValue === 0);
    test('height es INTEGER default 0', attrs.height.type.key === 'INTEGER' && attrs.height.defaultValue === 0);
    test('bytes es INTEGER default 0', attrs.bytes.type.key === 'INTEGER' && attrs.bytes.defaultValue === 0);

    test('uploadedAt es DATE not null', attrs.uploadedAt.type.key === 'DATE' && attrs.uploadedAt.allowNull === false);
    test('uploadedAt mapea a uploaded_at', attrs.uploadedAt.field === 'uploaded_at');

    // ------------------------------------------------------------
    // Tests: indexes
    // ------------------------------------------------------------
    console.log('\n=== TESTS: indexes ===\n');

    const uniqueIndex = capturedOptions.indexes?.find(idx => idx.unique === true);
    test('existe índice único', !!uniqueIndex);
    test('índice único sobre company_id y purpose',
        uniqueIndex?.fields?.includes('company_id') && uniqueIndex?.fields?.includes('purpose'));
    test('nombre del índice es uq_company_logos_company_purpose',
        uniqueIndex?.name === 'uq_company_logos_company_purpose');

    // ------------------------------------------------------------
    // Tests: validaciones de instancia (simuladas)
    // ------------------------------------------------------------
    console.log('\n=== TESTS: validaciones de instancia ===\n');

    // Caso válido
    const validLogo = {
        companyId: '00000000-0000-0000-0000-000000000001',
        purpose: 'invoice',
        publicId: 'ExpediFact/logos/c1/invoice',
        url: 'http://res.cloudinary.com/demo/image/upload/v1/logo.png',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/logo.png',
        format: 'png',
        width: 600,
        height: 400,
        bytes: 12345,
        uploadedAt: new Date()
    };

    let validErr = null;
    try { await mockModel.validate(validLogo); } catch (e) { validErr = e; }
    test('logo válido pasa validación', validErr === null, validErr?.message);

    // purpose inválido
    let purposeErr = null;
    try {
        await mockModel.validate({ ...validLogo, purpose: 'favicon' });
    } catch (e) { purposeErr = e; }
    test('purpose inválido falla', purposeErr !== null);

    // publicId vacío
    let emptyPubErr = null;
    try {
        await mockModel.validate({ ...validLogo, publicId: '' });
    } catch (e) { emptyPubErr = e; }
    test('publicId vacío falla', emptyPubErr !== null);

    // secureUrl vacío
    let emptySecErr = null;
    try {
        await mockModel.validate({ ...validLogo, secureUrl: '' });
    } catch (e) { emptySecErr = e; }
    test('secureUrl vacío falla', emptySecErr !== null);

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