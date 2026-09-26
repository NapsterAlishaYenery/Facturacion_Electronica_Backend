require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc1 = '130999917';
let testRnc2 = '130999918';
let testEmail1 = 'owner1-seq-all@expedinap.com';
let testEmail2 = 'owner2-seq-all@expedinap.com';
let adminEmail = 'admin-seq-all@expedinap.com';
let company1Id = null;
let company2Id = null;
let seq1Id = null;
let seq2Id = null;
let seq3Id = null;
let adminId = null;

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
        for (const rnc of [testRnc1, testRnc2]) {
            const old = await Company.findOne({ where: { rnc } });
            if (old) {
                await AuditLog.destroy({ where: { companyId: old.id } });
                await Invoice.destroy({ where: { companyId: old.id } });
                await Sequence.destroy({ where: { companyId: old.id } });
                await Subscription.destroy({ where: { companyId: old.id } });
                await User.destroy({ where: { companyId: old.id } });
                await Company.destroy({ where: { id: old.id } });
            }
        }
        await User.destroy({ where: { email: [testEmail1, testEmail2, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'SeqAll',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa 1 + dueño
        const res1 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc1, name: 'Alpha Sequences SRL' },
                owner: { email: testEmail1, password: 'OwnerPass123', firstName: 'Owner1', lastName: 'SeqAll' }
            })
        });
        company1Id = res1.body?.data?.company?.id;

        // Crear empresa 2 + dueño
        const res2 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc2, name: 'Beta Sequences SRL' },
                owner: { email: testEmail2, password: 'OwnerPass123', firstName: 'Owner2', lastName: 'SeqAll' }
            })
        });
        company2Id = res2.body?.data?.company?.id;

        // Crear 3 secuencias: 2 en empresa 1, 1 en empresa 2
        const seq1 = await Sequence.create({
            companyId: company1Id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 100,  // usada
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        seq1Id = seq1.id;

        const seq2 = await Sequence.create({
            companyId: company1Id,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 0,  // sin usar
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),  // vencida
            isActive: false
        });
        seq2Id = seq2.id;

        const seq3 = await Sequence.create({
            companyId: company2Id,
            type: '34',
            prefix: 'E',
            startNumber: 1,
            endNumber: 200,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        seq3Id = seq3.id;

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(testEmail1, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin lista todas sin filtros
        // ============================================================
        console.log('--- Test 1: admin lista todas ---');
        const listRes = await request('/api/sequences', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('has pagination', typeof listRes.body?.data?.pagination === 'object');
        test('totalItems >= 3', listRes.body?.data?.pagination?.totalItems >= 3);
        test('page is 1', listRes.body?.data?.pagination?.page === 1);

        const items = listRes.body?.data?.items || [];
        const ids = items.map(s => s.id);
        test('includes seq1', ids.includes(seq1Id));
        test('includes seq2', ids.includes(seq2Id));
        test('includes seq3', ids.includes(seq3Id));

        // Verificar que incluye datos de la empresa
        const seq1Item = items.find(s => s.id === seq1Id);
        test('seq1 has company', !!seq1Item?.company);
        test('seq1 company.rnc is testRnc1', seq1Item?.company?.rnc === testRnc1);
        test('seq1 company.name is Alpha', seq1Item?.company?.name === 'Alpha Sequences SRL');

        // Verificar campos calculados
        test('seq1 has isExpired', typeof seq1Item?.isExpired === 'boolean');
        test('seq1 has remainingNumbers', typeof seq1Item?.remainingNumbers === 'number');
        test('seq1 has usedPercentage', typeof seq1Item?.usedPercentage === 'number');

        // ============================================================
        // TEST 2: filtro por companyId
        // ============================================================
        console.log('\n--- Test 2: filtro por companyId ---');
        const companyFilterRes = await request(`/api/sequences?companyId=${company1Id}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', companyFilterRes.status === 200);
        test('all items belong to company1', companyFilterRes.body?.data?.items?.every(s => s.companyId === company1Id));
        test('does NOT include seq3', !companyFilterRes.body?.data?.items?.some(s => s.id === seq3Id));

        // ============================================================
        // TEST 3: filtro por type
        // ============================================================
        console.log('\n--- Test 3: filtro por type ---');
        const typeRes = await request('/api/sequences?type=32', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', typeRes.status === 200);
        test('all items type 32', typeRes.body?.data?.items?.every(s => s.type === '32'));

        // ============================================================
        // TEST 4: filtro por isActive=true
        // ============================================================
        console.log('\n--- Test 4: filtro isActive=true ---');
        const activeRes = await request('/api/sequences?isActive=true', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', activeRes.status === 200);
        test('all items isActive', activeRes.body?.data?.items?.every(s => s.isActive === true));
        test('does NOT include seq2 (inactive)', !activeRes.body?.data?.items?.some(s => s.id === seq2Id));

        // ============================================================
        // TEST 5: filtro por isActive=false
        // ============================================================
        console.log('\n--- Test 5: filtro isActive=false ---');
        const inactiveRes = await request('/api/sequences?isActive=false', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', inactiveRes.status === 200);
        test('all items isActive false', inactiveRes.body?.data?.items?.every(s => s.isActive === false));
        test('includes seq2', inactiveRes.body?.data?.items?.some(s => s.id === seq2Id));

        // ============================================================
        // TEST 6: filtro expired=true (vencidas)
        // ============================================================
        console.log('\n--- Test 6: filtro expired=true ---');
        const expiredRes = await request('/api/sequences?expired=true', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', expiredRes.status === 200);
        test('all items expired', expiredRes.body?.data?.items?.every(s => s.isExpired === true));
        test('includes seq2', expiredRes.body?.data?.items?.some(s => s.id === seq2Id));

        // ============================================================
        // TEST 7: filtro search por RNC de empresa
        // ============================================================
        console.log('\n--- Test 7: filtro search por RNC ---');
        const searchRes = await request(`/api/sequences?search=${testRnc1}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchRes.status === 200);
        test('all items belong to company1', searchRes.body?.data?.items?.every(s => s.companyId === company1Id));

        // ============================================================
        // TEST 8: filtro search por nombre de empresa
        // ============================================================
        console.log('\n--- Test 8: filtro search por nombre ---');
        const searchNameRes = await request('/api/sequences?search=Beta', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchNameRes.status === 200);
        test('all items belong to company2', searchNameRes.body?.data?.items?.every(s => s.companyId === company2Id));

        // ============================================================
        // TEST 9: paginación
        // ============================================================
        console.log('\n--- Test 9: paginación ---');
        const pagRes = await request('/api/sequences?limit=1&page=1', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', pagRes.status === 200);
        test('returns 1 item', pagRes.body?.data?.items?.length === 1);
        test('hasNextPage true', pagRes.body?.data?.pagination?.hasNextPage === true);
        test('totalPages >= 3', pagRes.body?.data?.pagination?.totalPages >= 3);

        // ============================================================
        // TEST 10: company_admin NO puede usar esta ruta
        // ============================================================
        console.log('\n--- Test 10: company_admin intenta ---');
        const forbiddenRes = await request('/api/sequences', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 11: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 11: sin autenticación ---');
        const noAuthRes = await request('/api/sequences');
        test('status 401', noAuthRes.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            for (const id of [company1Id, company2Id]) {
                if (id) {
                    await AuditLog.destroy({ where: { companyId: id } });
                    await Invoice.destroy({ where: { companyId: id } });
                    await Sequence.destroy({ where: { companyId: id } });
                    await Subscription.destroy({ where: { companyId: id } });
                    await User.destroy({ where: { companyId: id } });
                    await Company.destroy({ where: { id } });
                }
            }
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [testEmail1, testEmail2, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();