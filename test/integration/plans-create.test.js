require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { Plan, User, Company, AuditLog } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

// Helpers para obtener cookies de admin
async function loginAsAdmin() {
    // Admin del sistema — se asume que ya existe uno sembrado
    // Cambiá email/password si tu admin es otro
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.TEST_ADMIN_EMAIL || 'admin@expedinap.com',
            password: process.env.TEST_ADMIN_PASSWORD || 'AdminPass123'
        })
    });

    if (res.status !== 200) {
        throw new Error(`Admin login failed (${res.status}). Setea TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD en .env`);
    }

    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
    return accessCookieFull?.split(';')[0];
}

(async () => {
    const testCode = 'test_7_3';
    const testCodeUpper = 'TEST_7_3_UPPER';
    let adminCookie = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        await Plan.destroy({ where: { code: testCode } });
        await Plan.destroy({ where: { code: testCodeUpper } });
        await Plan.destroy({ where: { code: testCodeUpper.toLowerCase() } });

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // ============================================================
        // Test 1: Crear plan válido
        // ============================================================
        console.log('--- Test 1: Crear plan válido ---');
        const createRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: testCode,
                name: 'Plan Test 7.3',
                description: 'Plan de prueba para el step 7.3',
                priceDop: 1500.50,
                priceUsd: 25.75,
                invoicesPerMonth: 500,
                maxUsers: 3,
                maxSequences: 2,
                features: { reports: true, support: 'email' }
            })
        });

        await test('status 201', createRes.status === 201, `got ${createRes.status}`);
        await test('success true', createRes.body?.success === true);
        await test('plan code matches', createRes.body?.data?.plan?.code === testCode);
        await test('plan name matches', createRes.body?.data?.plan?.name === 'Plan Test 7.3');
        await test('plan isActive true', createRes.body?.data?.plan?.isActive === true);
        await test('priceDop matches', createRes.body?.data?.plan?.priceDop === '1500.50');

        // ============================================================
        // Test 2: Code duplicado → 409
        // ============================================================
        console.log('\n--- Test 2: Code duplicado ---');
        const dupRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: testCode,
                name: 'Otro Plan',
                priceDop: 100,
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1
            })
        });

        await test('status 409', dupRes.status === 409, `got ${dupRes.status}`);
        await test('code PLAN_CODE_ALREADY_EXISTS',
            dupRes.body?.error?.code === 'PLAN_CODE_ALREADY_EXISTS');

        // ============================================================
        // Test 3: Code en mayúsculas se normaliza a lowercase
        // ============================================================
        console.log('\n--- Test 3: Code uppercase → lowercase ---');
        const upperRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: testCodeUpper,
                name: 'Plan Uppercase',
                priceDop: 100,
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1
            })
        });

        await test('status 201', upperRes.status === 201, `got ${upperRes.status}`);
        await test('code normalized to lowercase',
            upperRes.body?.data?.plan?.code === testCodeUpper.toLowerCase());

        // ============================================================
        // Test 4: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 4: Sin autenticación ---');
        const noAuthRes = await request('/api/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'noauth_7_3',
                name: 'No Auth',
                priceDop: 100,
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1
            })
        });

        await test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // Test 5: Falta campo requerido → 400
        // ============================================================
        console.log('\n--- Test 5: Falta priceDop ---');
        const badRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: 'missing_price_7_3',
                name: 'Sin precio',
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1
            })
        });

        await test('status 400', badRes.status === 400, `got ${badRes.status}`);
        await test('code VALIDATION_ERROR', badRes.body?.error?.code === 'VALIDATION_ERROR');
        await test('error mentions priceDop',
            badRes.body?.error?.details?.some(d => d.field === 'priceDop'));

        // ============================================================
        // Test 6: priceDop negativo → 400
        // ============================================================
        console.log('\n--- Test 6: priceDop negativo ---');
        const negRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: 'negative_7_3',
                name: 'Negativo',
                priceDop: -100,
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1
            })
        });

        await test('status 400', negRes.status === 400, `got ${negRes.status}`);

        // ============================================================
        // Test 7: isActive enviado en body se ignora (siempre true)
        // ============================================================
        console.log('\n--- Test 7: isActive enviado pero ignorado ---');
        const ignoreRes = await request('/api/plans', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: 'ignore_active_7_3',
                name: 'Ignore Active',
                priceDop: 100,
                invoicesPerMonth: 10,
                maxUsers: 1,
                maxSequences: 1,
                isActive: false   // ← debe ignorarse (stripUnknown)
            })
        });

        await test('status 201', ignoreRes.status === 201, `got ${ignoreRes.status}`);
        await test('isActive is still true',
            ignoreRes.body?.data?.plan?.isActive === true);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await Plan.destroy({ where: { code: testCode } });
            await Plan.destroy({ where: { code: testCodeUpper.toLowerCase() } });
            await Plan.destroy({ where: { code: 'negative_7_3' } });
            await Plan.destroy({ where: { code: 'ignore_active_7_3' } });
            await Plan.destroy({ where: { code: 'missing_price_7_3' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();