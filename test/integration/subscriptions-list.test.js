require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, SubscriptionPayment, Plan, Sequence, AuditLog
} = require('../../src/models');

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
    if (res.status !== 200) throw new Error(`Admin login failed (${res.status})`);
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookieFull = cookies.find(c => c?.startsWith('access_token='));
    return accessCookieFull?.split(';')[0];
}

(async () => {
    const testRncs = ['130999201', '130999202', '130999203'];
    const testEmails = [
        'list-subs-a@expedinap.com',
        'list-subs-b@expedinap.com',
        'list-subs-c@expedinap.com'
    ];
    let adminCookie = null;
    const companyIds = [];

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        for (const rnc of testRncs) {
            const old = await Company.findOne({ where: { rnc } });
            if (old) {
                await AuditLog.destroy({ where: { companyId: old.id } });
                await SubscriptionPayment.destroy({ where: { companyId: old.id } });
                await Subscription.destroy({ where: { companyId: old.id } });
                await Sequence.destroy({ where: { companyId: old.id } });
                await User.destroy({ where: { companyId: old.id } });
                await Company.destroy({ where: { id: old.id } });
            }
        }

        adminCookie = await loginAsAdmin();
        console.log('✅ Admin login OK\n');

        // Setup: crear 3 empresas con suscripciones
        for (let i = 0; i < 3; i++) {
            const registerRes = await request('/api/auth/register-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company: { rnc: testRncs[i], name: `List Subs Test Co ${i}` },
                    owner: {
                        email: testEmails[i],
                        password: 'SecurePass123',
                        firstName: `Test${i}`,
                        lastName: 'User'
                    }
                })
            });
            companyIds.push(registerRes.body?.data?.company?.id);
        }

        // Cambiar el status de la segunda a 'active' (la primera y tercera quedan en 'trial')
        await Subscription.update(
            { status: 'active' },
            { where: { companyId: companyIds[1] } }
        );

        console.log('✅ Setup completed (3 companies, 2 trial + 1 active)\n');

        // ============================================================
        // Test 1: Listar sin filtros
        // ============================================================
        console.log('--- Test 1: Listar sin filtros ---');
        const res1 = await request('/api/subscriptions', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res1.status === 200, `got ${res1.status}`);
        await test('success true', res1.body?.success === true);
        await test('items is array', Array.isArray(res1.body?.data?.items));
        await test('totalItems >= 3', res1.body?.data?.pagination?.totalItems >= 3);
        await test('first item has company',
            !!res1.body?.data?.items?.[0]?.company);
        await test('first item has plan',
            !!res1.body?.data?.items?.[0]?.plan);

        // ============================================================
        // Test 2: Filtrar por status=active
        // ============================================================
        console.log('\n--- Test 2: Filtro status=active ---');
        const res2 = await request('/api/subscriptions?status=active', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res2.status === 200);
        await test('all items are active',
            res2.body?.data?.items?.every(s => s.status === 'active'));
        await test('at least 1 active item',
            res2.body?.data?.items?.length >= 1);

        // ============================================================
        // Test 3: Filtro por companyId
        // ============================================================
        console.log('\n--- Test 3: Filtro companyId ---');
        const res3 = await request(`/api/subscriptions?companyId=${companyIds[0]}`, {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res3.status === 200);
        await test('1 item returned', res3.body?.data?.items?.length === 1);
        await test('companyId matches',
            res3.body?.data?.items?.[0]?.companyId === companyIds[0]);

        // ============================================================
        // Test 4: Búsqueda por nombre de empresa
        // ============================================================
        console.log('\n--- Test 4: Búsqueda por nombre ---');
        const res4 = await request('/api/subscriptions?search=List Subs Test Co 1', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res4.status === 200);
        await test('1 item returned', res4.body?.data?.items?.length === 1);
        await test('company name matches',
            res4.body?.data?.items?.[0]?.company?.name === 'List Subs Test Co 1');

        // ============================================================
        // Test 5: Paginación
        // ============================================================
        console.log('\n--- Test 5: Paginación limit=2 ---');
        const res5 = await request('/api/subscriptions?limit=2&page=1', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 200', res5.status === 200);
        await test('2 items returned', res5.body?.data?.items?.length === 2);
        await test('hasNextPage true', res5.body?.data?.pagination?.hasNextPage === true);

        // ============================================================
        // Test 6: Status inválido → 400
        // ============================================================
        console.log('\n--- Test 6: Status inválido ---');
        const res6 = await request('/api/subscriptions?status=bogus', {
            headers: { 'Cookie': adminCookie }
        });

        await test('status 400', res6.status === 400, `got ${res6.status}`);
        await test('code VALIDATION_ERROR',
            res6.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // Test 7: Sin auth → 401
        // ============================================================
        console.log('\n--- Test 7: Sin auth ---');
        const res7 = await request('/api/subscriptions');
        await test('status 401', res7.status === 401, `got ${res7.status}`);

        // ============================================================
        // Test 8: Con auth company_admin (rol insuficiente) → 403
        // ============================================================
        console.log('\n--- Test 8: Rol insuficiente ---');
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmails[0],
                password: 'SecurePass123'
            })
        });
        const cookieHeader = loginRes.headers?.['set-cookie'];
        const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
        const ownerCookie = cookies.find(c => c?.startsWith('access_token='))?.split(';')[0];

        const res8 = await request('/api/subscriptions', {
            headers: { 'Cookie': ownerCookie }
        });
        await test('status 403', res8.status === 403, `got ${res8.status}`);
        await test('code INSUFFICIENT_ROLE',
            res8.body?.error?.code === 'INSUFFICIENT_ROLE');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            for (const cid of companyIds) {
                await AuditLog.destroy({ where: { companyId: cid } });
                await SubscriptionPayment.destroy({ where: { companyId: cid } });
                await Subscription.destroy({ where: { companyId: cid } });
                await Sequence.destroy({ where: { companyId: cid } });
                await User.destroy({ where: { companyId: cid } });
                await Company.destroy({ where: { id: cid } });
            }
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();