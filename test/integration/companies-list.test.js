require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc1 = '130999880';
let testRnc2 = '130999881';
let testRnc3 = '130999882';
let company1Id = null;
let company2Id = null;
let company3Id = null;
let adminEmail = 'admin-companies-list@expedinap.com';
let adminId = null;
let owner1Email = 'owner1-list@expedinap.com';
let owner2Email = 'owner2-list@expedinap.com';
let owner3Email = 'owner3-list@expedinap.com';

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
}

async function loginAndGetCookie(email, password) {
    const res = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const cookieHeader = res.headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader].filter(Boolean);
    const accessCookie = cookies.find(c => c?.startsWith('access_token='));
    return accessCookie?.split(';')[0];
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        for (const rnc of [testRnc1, testRnc2, testRnc3]) {
            const old = await Company.findOne({ where: { rnc } });
            if (old) {
                await AuditLog.destroy({ where: { companyId: old.id } });
                await Subscription.destroy({ where: { companyId: old.id } });
                await Sequence.destroy({ where: { companyId: old.id } });
                await User.destroy({ where: { companyId: old.id } });
                await Company.destroy({ where: { id: old.id } });
            }
        }
        await User.destroy({ where: { email: [adminEmail, owner1Email, owner2Email, owner3Email] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'List',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa 1 (activa, testecf)
        const res1 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc1, name: 'Alpha Company SRL', dgiiEnvironment: 'testecf' },
                owner: { email: owner1Email, password: 'OwnerPass123', firstName: 'Owner1', lastName: 'List' }
            })
        });
        company1Id = res1.body?.data?.company?.id;

        // Crear empresa 2 (activa, testecf, buscable por nombre único)
        const res2 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc2, name: 'Beta Searchable SRL', dgiiEnvironment: 'testecf' },
                owner: { email: owner2Email, password: 'OwnerPass123', firstName: 'Owner2', lastName: 'List' }
            })
        });
        company2Id = res2.body?.data?.company?.id;

        // Crear empresa 3 (activa, production)
        const res3 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc3, name: 'Gamma Company SRL', dgiiEnvironment: 'production' },
                owner: { email: owner3Email, password: 'OwnerPass123', firstName: 'Owner3', lastName: 'List' }
            })
        });
        company3Id = res3.body?.data?.company?.id;

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(owner1Email, 'OwnerPass123');

        // Desactivar empresa 3 directamente en BD (para probar filtro isActive)
        await Company.update({ isActive: false }, { where: { id: company3Id } });

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin lista todas (sin filtros)
        // ============================================================
        console.log('--- Test 1: admin lista sin filtros ---');
        const listRes = await request('/api/companies', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('has pagination', typeof listRes.body?.data?.pagination === 'object');
        test('totalItems >= 3', listRes.body?.data?.pagination?.totalItems >= 3, `count: ${listRes.body?.data?.pagination?.totalItems}`);
        test('page is 1', listRes.body?.data?.pagination?.page === 1);
        test('limit is 50', listRes.body?.data?.pagination?.limit === 50);
        test('hasNextPage false (default 50)', listRes.body?.data?.pagination?.hasNextPage === false);
        test('hasPrevPage false', listRes.body?.data?.pagination?.hasPrevPage === false);

        // Verificar que las 3 empresas de prueba están en la lista
        const items = listRes.body?.data?.items || [];
        const rncs = items.map(c => c.rnc);
        test('includes company1', rncs.includes(testRnc1));
        test('includes company2', rncs.includes(testRnc2));
        test('includes company3', rncs.includes(testRnc3));

        // Verificar que NO expone password del certificado
        test('does NOT expose certificatePassword', items.every(c => c.certificatePassword === undefined));

        // Verificar que incluye subscription
        const company1Item = items.find(c => c.rnc === testRnc1);
        test('company has subscription', !!company1Item?.subscription);
        test('company has plan', !!company1Item?.plan);

        // ============================================================
        // TEST 2: filtro isActive=true
        // ============================================================
        console.log('\n--- Test 2: filtro isActive=true ---');
        const activeRes = await request('/api/companies?isActive=true', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', activeRes.status === 200);
        test('all items isActive', activeRes.body?.data?.items?.every(c => c.isActive === true));
        test('does NOT include company3 (inactive)', !activeRes.body?.data?.items?.some(c => c.rnc === testRnc3));

        // ============================================================
        // TEST 3: filtro isActive=false
        // ============================================================
        console.log('\n--- Test 3: filtro isActive=false ---');
        const inactiveRes = await request('/api/companies?isActive=false', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', inactiveRes.status === 200);
        test('all items isActive=false', inactiveRes.body?.data?.items?.every(c => c.isActive === false));
        test('includes company3', inactiveRes.body?.data?.items?.some(c => c.rnc === testRnc3));

        // ============================================================
        // TEST 4: filtro dgiiEnvironment=production
        // ============================================================
        console.log('\n--- Test 4: filtro dgiiEnvironment=production ---');
        const prodRes = await request('/api/companies?dgiiEnvironment=production', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', prodRes.status === 200);
        test('all items production', prodRes.body?.data?.items?.every(c => c.dgiiEnvironment === 'production'));

        // ============================================================
        // TEST 5: filtro search por nombre
        // ============================================================
        console.log('\n--- Test 5: filtro search por nombre ---');
        const searchRes = await request('/api/companies?search=Searchable', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchRes.status === 200);
        test('finds company2', searchRes.body?.data?.items?.some(c => c.rnc === testRnc2));
        test('does NOT find company1', !searchRes.body?.data?.items?.some(c => c.rnc === testRnc1));

        // ============================================================
        // TEST 6: filtro search por RNC parcial
        // ============================================================
        console.log('\n--- Test 6: filtro search por RNC ---');
        const searchRncRes = await request(`/api/companies?search=${testRnc1}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchRncRes.status === 200);
        test('finds company1', searchRncRes.body?.data?.items?.some(c => c.rnc === testRnc1));

        // ============================================================
        // TEST 7: paginación (limit=1)
        // ============================================================
        console.log('\n--- Test 7: paginación limit=1 ---');
        const pagRes = await request('/api/companies?limit=1&page=1', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', pagRes.status === 200);
        test('returns 1 item', pagRes.body?.data?.items?.length === 1);
        test('hasNextPage true', pagRes.body?.data?.pagination?.hasNextPage === true);
        test('page is 1', pagRes.body?.data?.pagination?.page === 1);
        test('totalPages >= 3', pagRes.body?.data?.pagination?.totalPages >= 3);

        // Página 2
        const page2Res = await request('/api/companies?limit=1&page=2', {
            headers: { Cookie: adminCookie }
        });
        test('page2 returns 1 item', page2Res.body?.data?.items?.length === 1);
        test('page2 hasPrevPage true', page2Res.body?.data?.pagination?.hasPrevPage === true);
        test('page2 different item', page2Res.body?.data?.items?.[0]?.id !== pagRes.body?.data?.items?.[0]?.id);

        // ============================================================
        // TEST 8: company_admin NO puede listar todas
        // ============================================================
        console.log('\n--- Test 8: company_admin NO puede listar ---');
        const forbiddenRes = await request('/api/companies', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 9: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 9: sin autenticación ---');
        const noAuthRes = await request('/api/companies');
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            for (const id of [company1Id, company2Id, company3Id]) {
                if (id) {
                    await AuditLog.destroy({ where: { companyId: id } });
                    await Subscription.destroy({ where: { companyId: id } });
                    await Sequence.destroy({ where: { companyId: id } });
                    await User.destroy({ where: { companyId: id } });
                    await Company.destroy({ where: { id } });
                }
            }
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [adminEmail, owner1Email, owner2Email, owner3Email] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();