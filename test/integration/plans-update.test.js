require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { Plan } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

async function loginAsAdmin() {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.TEST_ADMIN_EMAIL,
            password: process.env.TEST_ADMIN_PASSWORD
        })
    });
    if (res.status !== 200) {
        throw new Error(`Admin login failed (${res.status})`);
    }
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
    return accessCookieFull?.split(';')[0];
}

(async () => {
    const codeA = 'test_7_4_a';
    const codeB = 'test_7_4_b';
    let adminCookie = null;
    let planAId = null;
    let planBId = null;

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await Plan.destroy({ where: { code: codeA } });
        await Plan.destroy({ where: { code: codeB } });

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // Setup: crear dos planes
        const planA = await Plan.create({
            code: codeA,
            name: 'Plan A',
            priceDop: 1000,
            invoicesPerMonth: 100,
            maxUsers: 2,
            maxSequences: 1
        });
        planAId = planA.id;

        const planB = await Plan.create({
            code: codeB,
            name: 'Plan B',
            priceDop: 2000,
            invoicesPerMonth: 500,
            maxUsers: 5,
            maxSequences: 3
        });
        planBId = planB.id;

        console.log('✅ Setup completed\n');

        // ============================================================
        // Test 1: Actualizar name y priceDop
        // ============================================================
        console.log('--- Test 1: Actualizar campos válidos ---');
        const res1 = await request(`/api/plans/${planAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                name: 'Plan A Renombrado',
                priceDop: 1500.50
            })
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('name updated', res1.body?.data?.plan?.name === 'Plan A Renombrado');
        await test('priceDop updated',
            Number(res1.body?.data?.plan?.priceDop) === 1500.50);
        await test('code unchanged', res1.body?.data?.plan?.code === codeA);

        // ============================================================
        // Test 2: Body vacío → 400
        // ============================================================
        console.log('\n--- Test 2: Body vacío ---');
        const res2 = await request(`/api/plans/${planAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({})
        });

        await test('status 400', res2.status === 400, `got ${res2.status}`);
        await test('code VALIDATION_ERROR', res2.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 3: Sin cambios reales → 400 NO_CHANGES_DETECTED
        // ============================================================
        console.log('\n--- Test 3: Sin cambios reales ---');
        const res3 = await request(`/api/plans/${planAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                name: 'Plan A Renombrado'  // ← mismo valor actual
            })
        });

        await test('status 400', res3.status === 400, `got ${res3.status}`);
        await test('code NO_CHANGES_DETECTED',
            res3.body?.error?.code === 'NO_CHANGES_DETECTED');

        // ============================================================
        // Test 4: Code duplicado → 409
        // ============================================================
        console.log('\n--- Test 4: Code duplicado ---');
        const res4 = await request(`/api/plans/${planAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: codeB  // ← ya usado por Plan B
            })
        });

        await test('status 409', res4.status === 409, `got ${res4.status}`);
        await test('code PLAN_CODE_ALREADY_EXISTS',
            res4.body?.error?.code === 'PLAN_CODE_ALREADY_EXISTS');

        // ============================================================
        // Test 5: Plan inexistente → 404
        // ============================================================
        console.log('\n--- Test 5: Plan inexistente ---');
        const res5 = await request('/api/plans/00000000-0000-0000-0000-000000000000', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ name: 'Whatever' })
        });

        await test('status 404', res5.status === 404, `got ${res5.status}`);
        await test('code PLAN_NOT_FOUND', res5.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 6: UUID inválido → 400
        // ============================================================
        console.log('\n--- Test 6: UUID inválido ---');
        const res6 = await request('/api/plans/not-a-uuid', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ name: 'Whatever' })
        });

        await test('status 400', res6.status === 400, `got ${res6.status}`);
        await test('code INVALID_ID_FORMAT',
            res6.body?.error?.code === 'INVALID_ID_FORMAT');

        // ============================================================
        // Test 7: Code uppercase se normaliza
        // ============================================================
        console.log('\n--- Test 7: Code uppercase normalizado ---');
        const res7 = await request(`/api/plans/${planAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                code: 'TEST_7_4_A_NEW'
            })
        });

        await test('status 200', res7.status === 200, `got ${res7.status}`);
        await test('code normalized',
            res7.body?.data?.plan?.code === 'test_7_4_a_new');

        // ============================================================
        // Test 8: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 8: Sin auth ---');
        const res8 = await request(`/api/plans/${planBId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Hack' })
        });

        await test('status 401', res8.status === 401, `got ${res8.status}`);

        // ============================================================
        // Test 9: isActive no es editable vía PATCH
        // ============================================================
        console.log('\n--- Test 9: isActive ignorado en PATCH ---');
        const res9 = await request(`/api/plans/${planBId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                name: 'Plan B Renombrado',
                isActive: false   // ← no está en el schema → stripUnknown lo elimina
            })
        });

        await test('status 200', res9.status === 200, `got ${res9.status}`);
        await test('isActive still true',
            res9.body?.data?.plan?.isActive === true);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await Plan.destroy({ where: { code: codeA } });
            await Plan.destroy({ where: { code: codeB } });
            await Plan.destroy({ where: { code: 'test_7_4_a_new' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();