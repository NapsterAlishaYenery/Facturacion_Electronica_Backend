// ============================================================
// Test unitario: ApiKey model
// Mockea config/database para no tocar la BD real.
// Verifica atributos, mappings, validadores, índices y toJSON.
// ============================================================

const { DataTypes } = require('sequelize');

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
// Helper: normalizar validadores de Sequelize
// Sequelize puede guardar validate.is como:
//   - { args: [regex], msg: '...' }
//   - [{ args: [regex], msg: '...' }]
// Esta función devuelve siempre el primer validador normalizado.
// ------------------------------------------------------------
function firstValidator(v) {
    if (!v) return null;
    if (Array.isArray(v)) return v[0];
    return v;
}

// ------------------------------------------------------------
// Mock de config/database
// ------------------------------------------------------------
const dbPath = require.resolve('../../src/config/database');

const mockSequelize = {
    define: (modelName, attributes, options) => {
        return {
            _modelName: modelName,
            _attributes: attributes,
            _options: options,
            rawAttributes: attributes,
            prototype: {
                toJSON: function () {
                    const values = { ...this };
                    return values;
                }
            }
        };
    }
};

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockSequelize
};

const ApiKey = require('../../src/models/apiKey.model');

// ============================================================
console.log('=== TESTS: ApiKey model ===\n');

// ------------------------------------------------------------
// 1. Metadatos
// ------------------------------------------------------------
console.log('--- Metadatos ---');
test('modelName = ApiKey', ApiKey._modelName === 'ApiKey');
test('tableName = api_keys', ApiKey._options.tableName === 'api_keys');
test('timestamps = true', ApiKey._options.timestamps === true);
test('underscored = true', ApiKey._options.underscored === true);
test('createdAt mapped a created_at', ApiKey._options.createdAt === 'created_at');
test('updatedAt mapped a updated_at', ApiKey._options.updatedAt === 'updated_at');

// ------------------------------------------------------------
// 2. Atributos
// ------------------------------------------------------------
console.log('\n--- Atributos ---');

const idAttr = ApiKey._attributes.id;
test('id es UUID', idAttr.type.key === DataTypes.UUID.key);
test('id es primaryKey', idAttr.primaryKey === true);
test('id tiene defaultValue UUIDV4', idAttr.defaultValue === DataTypes.UUIDV4);

const companyAttr = ApiKey._attributes.companyId;
test('companyId es UUID', companyAttr.type.key === DataTypes.UUID.key);
test('companyId allowNull = false', companyAttr.allowNull === false);
test('companyId mapea a company_id', companyAttr.field === 'company_id');

const nameAttr = ApiKey._attributes.name;
test('name es STRING(100)',
    nameAttr.type.key === DataTypes.STRING.key &&
    nameAttr.type.options.length === 100);
test('name allowNull = false', nameAttr.allowNull === false);
test('name tiene notEmpty', !!nameAttr.validate.notEmpty);
test('name len [2,100]',
    nameAttr.validate.len.args[0] === 2 &&
    nameAttr.validate.len.args[1] === 100);

// --- keyHash ---
const hashAttr = ApiKey._attributes.keyHash;
test('keyHash es STRING(64)',
    hashAttr.type.key === DataTypes.STRING.key &&
    hashAttr.type.options.length === 64);
test('keyHash allowNull = false', hashAttr.allowNull === false);
test('keyHash mapea a key_hash', hashAttr.field === 'key_hash');

// Buscar el RegExp en cualquier forma que Sequelize lo haya guardado:
//   - validate.is = { args: [regex], msg: '...' }
//   - validate.is = [{ args: [regex], msg: '...' }]
//   - validate.is = { args: [[regex]], msg: '...' }
//   - validate.is = function (que internamente tiene el regex, no accesible)
// Estrategia: buscar recursivamente cualquier RegExp en validate.is.
function findRegex(obj, depth = 0) {
    if (!obj || depth > 4) return null;
    if (obj instanceof RegExp) return obj;
    if (typeof obj === 'string') return null;
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const found = findRegex(item, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const found = findRegex(obj[key], depth + 1);
            if (found) return found;
        }
    }
    return null;
}

const hashRegex = findRegex(hashAttr.validate.is);

test('keyHash valida hex 64',
    hashRegex instanceof RegExp && hashRegex.test('a'.repeat(64)),
    `regex=${hashRegex}`);
test('keyHash rechaza hex 63',
    hashRegex instanceof RegExp && !hashRegex.test('a'.repeat(63)));
test('keyHash rechaza mayúsculas',
    hashRegex instanceof RegExp && !hashRegex.test('A'.repeat(64)));

// --- keyPrefix ---
const prefixAttr = ApiKey._attributes.keyPrefix;
test('keyPrefix es STRING(20)',
    prefixAttr.type.key === DataTypes.STRING.key &&
    prefixAttr.type.options.length === 20);
test('keyPrefix allowNull = false', prefixAttr.allowNull === false);
test('keyPrefix mapea a key_prefix', prefixAttr.field === 'key_prefix');
test('keyPrefix tiene notEmpty', !!prefixAttr.validate.notEmpty);

// --- environment ---
const envAttr = ApiKey._attributes.environment;
test('environment es STRING(20)',
    envAttr.type.key === DataTypes.STRING.key &&
    envAttr.type.options.length === 20);
test('environment allowNull = false', envAttr.allowNull === false);

const envIsIn = firstValidator(envAttr.validate.isIn);
const envValues = envIsIn?.args?.[0] || [];
test('environment acepta testecf', envValues.includes('testecf'));
test('environment acepta production', envValues.includes('production'));
test('environment rechaza otros', !envValues.includes('staging'));

// --- lastUsedAt ---
const lastUsedAttr = ApiKey._attributes.lastUsedAt;
test('lastUsedAt es DATE', lastUsedAttr.type.key === DataTypes.DATE.key);
test('lastUsedAt allowNull = true', lastUsedAttr.allowNull === true);
test('lastUsedAt mapea a last_used_at', lastUsedAttr.field === 'last_used_at');

// --- expiresAt ---
const expiresAttr = ApiKey._attributes.expiresAt;
test('expiresAt es DATE', expiresAttr.type.key === DataTypes.DATE.key);
test('expiresAt allowNull = true', expiresAttr.allowNull === true);
test('expiresAt mapea a expires_at', expiresAttr.field === 'expires_at');

// --- isActive ---
const isActiveAttr = ApiKey._attributes.isActive;
test('isActive es BOOLEAN', isActiveAttr.type.key === DataTypes.BOOLEAN.key);
test('isActive allowNull = false', isActiveAttr.allowNull === false);
test('isActive defaultValue = true', isActiveAttr.defaultValue === true);
test('isActive mapea a is_active', isActiveAttr.field === 'is_active');

// --- revokedAt ---
const revokedAttr = ApiKey._attributes.revokedAt;
test('revokedAt es DATE', revokedAttr.type.key === DataTypes.DATE.key);
test('revokedAt allowNull = true', revokedAttr.allowNull === true);
test('revokedAt mapea a revoked_at', revokedAttr.field === 'revoked_at');

// --- createdBy ---
const createdByAttr = ApiKey._attributes.createdBy;
test('createdBy es UUID', createdByAttr.type.key === DataTypes.UUID.key);
test('createdBy allowNull = true', createdByAttr.allowNull === true);
test('createdBy mapea a created_by', createdByAttr.field === 'created_by');

// ------------------------------------------------------------
// 3. Índices
// ------------------------------------------------------------
console.log('\n--- Índices ---');
const indexes = ApiKey._options.indexes || [];
test('hay 4 índices declarados', indexes.length === 4);

const hasHashIdx = indexes.some(i =>
    i.fields.length === 1 && i.fields[0] === 'key_hash' && i.unique === true
);
test('UNIQUE en key_hash', hasHashIdx);

const hasCompanyIdx = indexes.some(i =>
    i.fields.length === 1 && i.fields[0] === 'company_id'
);
test('índice en company_id', hasCompanyIdx);

const hasActiveIdx = indexes.some(i =>
    i.fields.length === 1 && i.fields[0] === 'is_active'
);
test('índice en is_active', hasActiveIdx);

const hasCompositeIdx = indexes.some(i =>
    i.fields.length === 2 &&
    i.fields[0] === 'company_id' &&
    i.fields[1] === 'is_active' &&
    i.where && i.where.is_active === true
);
test('índice parcial (company_id, is_active) WHERE is_active = true',
    hasCompositeIdx);

// ------------------------------------------------------------
// 4. toJSON
// ------------------------------------------------------------
console.log('\n--- toJSON ---');
test('toJSON existe en prototype',
    typeof ApiKey.prototype.toJSON === 'function');

// Simulamos una instancia con get() como hace Sequelize
const fakeInstance = {
    id: 'uuid-1',
    companyId: 'uuid-company',
    name: 'POS sucursal 1',
    keyHash: 'a'.repeat(64),           // ← este debe desaparecer
    keyPrefix: 'pk_live_a1b2c3',
    environment: 'production',
    lastUsedAt: null,
    expiresAt: null,
    isActive: true,
    revokedAt: null,
    createdBy: 'uuid-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    get: function () { return { ...this }; }
};

const json = ApiKey.prototype.toJSON.call(fakeInstance);
test('toJSON elimina keyHash', !('keyHash' in json));
test('toJSON conserva keyPrefix', json.keyPrefix === 'pk_live_a1b2c3');
test('toJSON conserva name', json.name === 'POS sucursal 1');
test('toJSON conserva environment', json.environment === 'production');
test('toJSON conserva isActive', json.isActive === true);

// ============================================================
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);