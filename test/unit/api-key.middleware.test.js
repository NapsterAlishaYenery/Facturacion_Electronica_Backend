// ============================================================
// Test unitario: apiKeyMiddleware
//
// Mockea ApiKey y User con require.cache.
// Verifica:
//   - Sin X-API-Key → next() sin req.user
//   - Key válida → req.user + req.apiKey + isApiKey: true + next()
//   - Key inválida → 401 INVALID_API_KEY
//   - Key revocada → 401 INVALID_API_KEY
//   - Key expirada → 401 API_KEY_EXPIRED
//   - Empresa sin admin → 401 API_KEY_NO_ADMIN
//   - lastUsedAt se actualiza (update llamado)
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
// Mock de modelos
// ------------------------------------------------------------
const modelsPath = require.resolve('../../src/models');

const fakeModels = {
    ApiKey: { findOne: async () => null },
    User: { findOne: async () => null }
};

require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: fakeModels
};

const apiKeyMiddleware = require('../../src/shared/middlewares/apiKey.middleware');

// ------------------------------------------------------------
// Helper: construir req/res/next fake
// ------------------------------------------------------------
function makeReq(headers = {}) {
    return { headers };
}

function makeRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
    return res;
}

function makeNext() {
    let called = false;
    const next = () => { called = true; };
    next.wasCalled = () => called;
    return next;
}

// ============================================================
(async () => {
    console.log('=== TESTS: apiKeyMiddleware ===\n');

    // ----------------------------------------------------------
    // 1. Sin X-API-Key → next() sin req.user
    // ----------------------------------------------------------
    console.log('--- Sin X-API-Key ---');
    {
        const req = makeReq();
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() fue llamado', next.wasCalled() === true);
        test('req.user no fue seteado', req.user === undefined);
        test('no tocó res', res.statusCode === 200 && res.body === null);
    }

    // ----------------------------------------------------------
    // 2. Key válida (activa, no expirada)
    // ----------------------------------------------------------
    console.log('\n--- Key válida ---');
    {
        let updateCalled = false;
        const fakeApiKey = {
            id: 'key-1',
            companyId: 'company-1',
            isActive: true,
            expiresAt: null,
            update: async (data) => { updateCalled = true; }
        };
        const fakeUser = {
            id: 'user-1',
            companyId: 'company-1',
            role: 'company_admin',
            isActive: true
        };

        fakeModels.ApiKey.findOne = async () => fakeApiKey;
        fakeModels.User.findOne = async () => fakeUser;

        const req = makeReq({ 'x-api-key': 'pk_live_abc123' });
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() fue llamado', next.wasCalled() === true);
        test('req.user seteado', req.user === fakeUser);
        test('req.user.isApiKey = true', req.user.isApiKey === true);
        test('req.user.role = company_admin',
            req.user.role === 'company_admin');
        test('req.apiKey seteado', req.apiKey === fakeApiKey);
        test('lastUsedAt update fue llamado', updateCalled === true);
    }

    // ----------------------------------------------------------
    // 3. Key inválida (no existe o revocada)
    // ----------------------------------------------------------
    console.log('\n--- Key inválida ---');
    {
        fakeModels.ApiKey.findOne = async () => null;

        const req = makeReq({ 'x-api-key': 'pk_live_invalid' });
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() NO fue llamado', next.wasCalled() === false);
        test('status 401', res.statusCode === 401);
        test('code INVALID_API_KEY',
            res.body?.error?.code === 'INVALID_API_KEY');
    }

    // ----------------------------------------------------------
    // 4. Key expirada
    // ----------------------------------------------------------
    console.log('\n--- Key expirada ---');
    {
        const fakeApiKey = {
            id: 'key-1',
            companyId: 'company-1',
            isActive: true,
            expiresAt: new Date(Date.now() - 1000), // ayer
            update: async () => {}
        };
        fakeModels.ApiKey.findOne = async () => fakeApiKey;

        const req = makeReq({ 'x-api-key': 'pk_live_expired' });
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() NO fue llamado', next.wasCalled() === false);
        test('status 401', res.statusCode === 401);
        test('code API_KEY_EXPIRED',
            res.body?.error?.code === 'API_KEY_EXPIRED');
    }

    // ----------------------------------------------------------
    // 5. Empresa sin admin activo
    // ----------------------------------------------------------
    console.log('\n--- Empresa sin admin ---');
    {
        const fakeApiKey = {
            id: 'key-1',
            companyId: 'company-1',
            isActive: true,
            expiresAt: null,
            update: async () => {}
        };
        fakeModels.ApiKey.findOne = async () => fakeApiKey;
        fakeModels.User.findOne = async () => null;

        const req = makeReq({ 'x-api-key': 'pk_live_noadmin' });
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() NO fue llamado', next.wasCalled() === false);
        test('status 401', res.statusCode === 401);
        test('code API_KEY_NO_ADMIN',
            res.body?.error?.code === 'API_KEY_NO_ADMIN');
    }

    // ----------------------------------------------------------
    // 6. Key con expiresAt en el futuro → válida
    // ----------------------------------------------------------
    console.log('\n--- Key con expiresAt futuro ---');
    {
        const fakeApiKey = {
            id: 'key-1',
            companyId: 'company-1',
            isActive: true,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            update: async () => {}
        };
        const fakeUser = {
            id: 'user-1', companyId: 'company-1',
            role: 'company_admin', isActive: true
        };
        fakeModels.ApiKey.findOne = async () => fakeApiKey;
        fakeModels.User.findOne = async () => fakeUser;

        const req = makeReq({ 'x-api-key': 'pk_live_future' });
        const res = makeRes();
        const next = makeNext();

        await apiKeyMiddleware(req, res, next);

        test('next() fue llamado', next.wasCalled() === true);
        test('req.user seteado', req.user === fakeUser);
    }

    console.log('\n✅ Tests completados');
    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();