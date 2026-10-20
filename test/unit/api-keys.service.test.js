// ============================================================
// Test unitario: api-keys.service
//
// Mockea modelos + sequelize con require.cache para no tocar BD.
// Verifica:
//   - generateSecret: prefijo correcto, hash sha256, prefix visible
//   - assertApiAccessAllowed: bypass system owner, rechazo sin plan
//   - createApiKey: límite de keys, audit, secret en respuesta
//   - listApiKeys: no expone keyHash ni secret
//   - revokeApiKey: 404 / 409 / soft revoke + audit
// ============================================================

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
// Mock de AppError
// ------------------------------------------------------------
const errorMwPath = require.resolve('../../src/shared/middlewares/error.middleware');

class FakeAppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

require.cache[errorMwPath] = {
    id: errorMwPath,
    filename: errorMwPath,
    loaded: true,
    exports: { AppError: FakeAppError }
};

// ------------------------------------------------------------
// Mock de sequelize (transaction pasa directo el mock de tx)
// ------------------------------------------------------------
const dbPath = require.resolve('../../src/config/database');
const fakeTx = { LOCK: { UPDATE: 'UPDATE' } };

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
        transaction: async (fn) => fn(fakeTx)
    }
};

// ------------------------------------------------------------
// Mock de modelos (registro de llamadas)
// ------------------------------------------------------------
const modelsPath = require.resolve('../../src/models');

const fakeModels = {
    Company: { findByPk: async () => null },
    User: {},
    ApiKey: {
        create: async () => null,
        findOne: async () => null,
        findAll: async () => [],
        count: async () => 0
    },
    Subscription: { findOne: async () => null },
    Plan: {},
    AuditLog: { create: async () => null }
};

require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: fakeModels
};

// Cargar el servicio (usará los mocks)
const service = require('../../src/modules/api-key/api-keys.service');
const { generateSecret } = service._helpers;

// ============================================================
console.log('=== TESTS: api-keys.service (unit) ===\n');

// ------------------------------------------------------------
// 1. generateSecret
// ------------------------------------------------------------
console.log('--- generateSecret ---');

const prodSecret = generateSecret('production');
test('prefijo pk_live_ en production',
    prodSecret.secret.startsWith('pk_live_'));
test('secret tiene 8 (prefix) + 64 (hex) = 72 chars',
    prodSecret.secret.length === 72,
    `got ${prodSecret.secret.length}`);
test('keyPrefix empieza con pk_live_ y 6 chars visibles',
    prodSecret.keyPrefix.startsWith('pk_live_') &&
    prodSecret.keyPrefix.length === 8 + 6,
    `got ${prodSecret.keyPrefix}`);
test('keyHash es hex 64',
    /^[0-9a-f]{64}$/.test(prodSecret.keyHash));
test('keyHash NO es igual al secret',
    prodSecret.keyHash !== prodSecret.secret);

const testSecret = generateSecret('testecf');
test('prefijo pk_test_ en testecf',
    testSecret.secret.startsWith('pk_test_'));
test('keyPrefix empieza con pk_test_',
    testSecret.keyPrefix.startsWith('pk_test_'));

// Verificar que dos llamadas generan secrets distintos
const a = generateSecret('production');
const b = generateSecret('production');
test('dos secrets son distintos', a.secret !== b.secret);
test('dos hashes son distintos', a.keyHash !== b.keyHash);

// ------------------------------------------------------------
// 2. createApiKey — flujo feliz
// ------------------------------------------------------------
console.log('\n--- createApiKey: flujo feliz ---');

let createdApiKey = null;

(async () => {
    try {
        // Setup: empresa enterprise + subscription con api_access
        fakeModels.Company.findByPk = async () => ({
            id: 'company-1',
            isActive: true,
            isSystemOwner: false,
            dgiiEnvironment: 'production'
        });

        fakeModels.Subscription.findOne = async () => ({
            status: 'active',
            plan: { name: 'Enterprise', features: { api_access: true } }
        });

        fakeModels.ApiKey.count = async () => 0;

        fakeModels.ApiKey.create = async (data) => {
            createdApiKey = { ...data, id: 'key-1', createdAt: new Date() };
            return createdApiKey;
        };

        let auditCalled = false;
        fakeModels.AuditLog.create = async () => {
            auditCalled = true;
            return { id: 'audit-1' };
        };

        const result = await service.createApiKey(
            'company-1',
            { name: 'POS sucursal 1', expiresInDays: 30 },
            { id: 'user-1' },
            { ip: '1.2.3.4', userAgent: 'test' }
        );

        test('devuelve secret en claro', !!result.secret);
        test('secret empieza con pk_live_',
            result.secret.startsWith('pk_live_'));
        test('keyPrefix coincide con el inicio del secret',
            result.secret.startsWith(result.keyPrefix));
        test('audit log creado', auditCalled === true);
        test('ApiKey.create recibió companyId correcto',
            createdApiKey.companyId === 'company-1');
        test('ApiKey.create recibió environment production',
            createdApiKey.environment === 'production');
        test('expiresAt calculado (30 días en el futuro)',
            createdApiKey.expiresAt instanceof Date &&
            createdApiKey.expiresAt > new Date());
        test('keyHash guardado es hex 64',
            /^[0-9a-f]{64}$/.test(createdApiKey.keyHash));

        // ------------------------------------------------------
        // 3. createApiKey — sin api_access
        // ------------------------------------------------------
        console.log('\n--- createApiKey: plan sin api_access ---');

        fakeModels.Subscription.findOne = async () => ({
            status: 'active',
            plan: { name: 'Pro', features: { api_access: false } }
        });

        let caught1 = null;
        try {
            await service.createApiKey(
                'company-1',
                { name: 'Test' },
                { id: 'user-1' },
                {}
            );
        } catch (e) { caught1 = e; }

        test('lanza 403 API_ACCESS_NOT_IN_PLAN',
            caught1 instanceof FakeAppError &&
            caught1.statusCode === 403 &&
            caught1.code === 'API_ACCESS_NOT_IN_PLAN',
            `got ${caught1?.code}`);

        // ------------------------------------------------------
        // 4. createApiKey — límite alcanzado
        // ------------------------------------------------------
        console.log('\n--- createApiKey: límite de keys ---');

        fakeModels.Subscription.findOne = async () => ({
            status: 'active',
            plan: { name: 'Enterprise', features: { api_access: true } }
        });
        fakeModels.ApiKey.count = async () => 10; // MAX_ACTIVE_KEYS_PER_COMPANY

        let caught2 = null;
        try {
            await service.createApiKey(
                'company-1',
                { name: 'Test' },
                { id: 'user-1' },
                {}
            );
        } catch (e) { caught2 = e; }

        test('lanza 409 MAX_API_KEYS_REACHED',
            caught2 instanceof FakeAppError &&
            caught2.statusCode === 409 &&
            caught2.code === 'MAX_API_KEYS_REACHED',
            `got ${caught2?.code}`);

        // ------------------------------------------------------
        // 5. createApiKey — system owner bypass
        // ------------------------------------------------------
        console.log('\n--- createApiKey: system owner bypass ---');

        fakeModels.Company.findByPk = async () => ({
            id: 'company-1',
            isActive: true,
            isSystemOwner: true,
            dgiiEnvironment: 'testecf'
        });

        fakeModels.ApiKey.count = async () => 0;
        fakeModels.ApiKey.create = async (data) => {
            return { ...data, id: 'key-2', createdAt: new Date() };
        };

        const sysResult = await service.createApiKey(
            'company-1',
            { name: 'System' },
            { id: 'user-1' },
            {}
        );
        test('system owner crea key sin plan',
            !!sysResult.secret);
        test('environment testecf → prefijo pk_test_',
            sysResult.secret.startsWith('pk_test_'));

        // ------------------------------------------------------
        // 6. revokeApiKey — 404
        // ------------------------------------------------------
        console.log('\n--- revokeApiKey: 404 ---');

        fakeModels.ApiKey.findOne = async () => null;

        let caught3 = null;
        try {
            await service.revokeApiKey(
                'company-1', 'key-x', { id: 'user-1' }, {}
            );
        } catch (e) { caught3 = e; }

        test('lanza 404 API_KEY_NOT_FOUND',
            caught3 instanceof FakeAppError &&
            caught3.statusCode === 404 &&
            caught3.code === 'API_KEY_NOT_FOUND',
            `got ${caught3?.code}`);

        // ------------------------------------------------------
        // 7. revokeApiKey — ya revocada
        // ------------------------------------------------------
        console.log('\n--- revokeApiKey: ya revocada ---');

        fakeModels.ApiKey.findOne = async () => ({
            id: 'key-1',
            isActive: false,
            update: async () => {}
        });

        let caught4 = null;
        try {
            await service.revokeApiKey(
                'company-1', 'key-1', { id: 'user-1' }, {}
            );
        } catch (e) { caught4 = e; }

        test('lanza 409 API_KEY_ALREADY_REVOKED',
            caught4 instanceof FakeAppError &&
            caught4.statusCode === 409 &&
            caught4.code === 'API_KEY_ALREADY_REVOKED',
            `got ${caught4?.code}`);

        // ------------------------------------------------------
        // 8. revokeApiKey — soft revoke exitoso
        // ------------------------------------------------------
        console.log('\n--- revokeApiKey: éxito ---');

        let updatedData = null;
        fakeModels.ApiKey.findOne = async () => ({
            id: 'key-1',
            name: 'POS',
            keyPrefix: 'pk_live_abc123',
            isActive: true,
            update: async (data) => { updatedData = data; }
        });

        const revokeResult = await service.revokeApiKey(
            'company-1', 'key-1', { id: 'user-1' }, {}
        );
        test('isActive = false en update',
            updatedData.isActive === false);
        test('revokedAt presente',
            updatedData.revokedAt instanceof Date);
        test('respuesta incluye id',
            revokeResult.id === 'key-1');
        test('respuesta incluye revokedAt',
            revokeResult.revokedAt instanceof Date);

        // ------------------------------------------------------
        // 9. listApiKeys
        // ------------------------------------------------------
        console.log('\n--- listApiKeys ---');

        fakeModels.ApiKey.findAll = async () => [
            {
                toJSON: () => ({
                    id: 'key-1',
                    name: 'POS',
                    keyPrefix: 'pk_live_abc123',
                    environment: 'production',
                    isActive: true,
                    expiresAt: null,
                    revokedAt: null,
                    lastUsedAt: null,
                    createdBy: 'user-1',
                    createdAt: new Date()
                })
            },
            {
                toJSON: () => ({
                    id: 'key-2',
                    name: 'ERP',
                    keyPrefix: 'pk_test_xyz789',
                    environment: 'testecf',
                    isActive: false,
                    expiresAt: null,
                    revokedAt: new Date(),
                    lastUsedAt: null,
                    createdBy: 'user-1',
                    createdAt: new Date()
                })
            }
        ];

        const listResult = await service.listApiKeys('company-1');
        test('devuelve 2 keys', listResult.length === 2);
        test('NO incluye keyHash en respuesta',
            listResult.every(k => !('keyHash' in k)));
        test('incluye campo expired calculado',
            listResult.every(k => 'expired' in k));
        test('key sin expiresAt → expired = false',
            listResult[0].expired === false);

        console.log('\n✅ Tests completados');

    } catch (err) {
        console.error('❌ Test crashed:', err.message);
        console.error(err.stack);
        failed++;
    }

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();