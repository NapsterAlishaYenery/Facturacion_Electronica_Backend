require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999910';
let testEmail = 'owner-seq-list@expedinap.com';
let adminEmail = 'admin-seq-list@expedinap.com';
let testCompanyId = null;
let adminId = null;
let sequence1Id = null;
let sequence2Id = null;

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
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await AuditLog.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: [testEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'SeqList',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Sequences List Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'SeqList'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Crear secuencias directamente en BD
        // Secuencia 1: tipo 32, vigente, activa, algo usada
        const seq1 = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 100, // 100 usados, 900 restantes
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 año
            isActive: true
        });
        sequence1Id = seq1.id;

        // Secuencia 2: tipo 31, vencida, inactiva
        const seq2 = await Sequence.create({
            companyId: testCompanyId,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 0, // nada usado
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // ayer
            isActive: false
        });
        sequence2Id = seq2.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin lista sus secuencias
        // ============================================================
        console.log('--- Test 1: company_admin lista sus secuencias ---');
        const listRes = await request('/api/sequences/me', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('has pagination', typeof listRes.body?.data?.pagination === 'object');
        test('totalItems is 2', listRes.body?.data?.pagination?.totalItems === 2);
        test('page is 1', listRes.body?.data?.pagination?.page === 1);

        // ============================================================
        // TEST 2: verificar campos calculados
        // ============================================================
        console.log('\n--- Test 2: campos calculados ---');
        const items = listRes.body?.data?.items || [];
        const seq1Item = items.find(s => s.id === sequence1Id);
        const seq2Item = items.find(s => s.id === sequence2Id);

        test('seq1 exists', !!seq1Item);
        test('seq2 exists', !!seq2Item);

        // seq1: activa, vigente, currentNumber 100
        test('seq1.isExpired is false', seq1Item?.isExpired === false);
        test('seq1.remainingNumbers is 900', seq1Item?.remainingNumbers === 900, `got ${seq1Item?.remainingNumbers}`);
        test('seq1.totalNumbers is 1000', seq1Item?.totalNumbers === 1000);
        test('seq1.usedPercentage is 10', seq1Item?.usedPercentage === 10, `got ${seq1Item?.usedPercentage}`);

        // seq2: inactiva, vencida, currentNumber 0
        test('seq2.isExpired is true', seq2Item?.isExpired === true);
        test('seq2.remainingNumbers is 500', seq2Item?.remainingNumbers === 500);
        test('seq2.usedPercentage is 0', seq2Item?.usedPercentage === 0);

        // ============================================================
        // TEST 3: filtro por type
        // ============================================================
        console.log('\n--- Test 3: filtro por type ---');
        const typeRes = await request('/api/sequences/me?type=32', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', typeRes.status === 200);
        test('returns 1 item', typeRes.body?.data?.items?.length === 1);
        test('item is type 32', typeRes.body?.data?.items?.[0]?.type === '32');

        // ============================================================
        // TEST 4: filtro isActive
        // ============================================================
        console.log('\n--- Test 4: filtro isActive ---');
        const activeRes = await request('/api/sequences/me?isActive=true', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', activeRes.status === 200);
        test('all active', activeRes.body?.data?.items?.every(s => s.isActive === true));

        // ============================================================
        // TEST 5: filtro expired=false (solo vigentes)
        // ============================================================
        console.log('\n--- Test 5: filtro expired=false ---');
        const vigentesRes = await request('/api/sequences/me?expired=false', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', vigentesRes.status === 200);
        test('all vigentes', vigentesRes.body?.data?.items?.every(s => s.isExpired === false));
        test('includes seq1', vigentesRes.body?.data?.items?.some(s => s.id === sequence1Id));
        test('does NOT include seq2', !vigentesRes.body?.data?.items?.some(s => s.id === sequence2Id));

        // ============================================================
        // TEST 6: filtro expired=true (solo vencidas)
        // ============================================================
        console.log('\n--- Test 6: filtro expired=true ---');
        const vencidasRes = await request('/api/sequences/me?expired=true', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', vencidasRes.status === 200);
        test('all vencidas', vencidasRes.body?.data?.items?.every(s => s.isExpired === true));
        test('includes seq2', vencidasRes.body?.data?.items?.some(s => s.id === sequence2Id));

        // ============================================================
        // TEST 7: paginación limit=1
        // ============================================================
        console.log('\n--- Test 7: paginación limit=1 ---');
        const pagRes = await request('/api/sequences/me?limit=1&page=1', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', pagRes.status === 200);
        test('returns 1 item', pagRes.body?.data?.items?.length === 1);
        test('hasNextPage true', pagRes.body?.data?.pagination?.hasNextPage === true);
        test('totalPages is 2', pagRes.body?.data?.pagination?.totalPages === 2);

        // ============================================================
        // TEST 8: filtro type inválido → 400
        // ============================================================
        console.log('\n--- Test 8: type inválido ---');
        const badTypeRes = await request('/api/sequences/me?type=99', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', badTypeRes.status === 400);
        test('code VALIDATION_ERROR', badTypeRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 9: admin intenta usar /me → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 9: admin intenta /me ---');
        const adminMeRes = await request('/api/sequences/me', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminMeRes.status === 400, `got ${adminMeRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminMeRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 10: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 10: sin autenticación ---');
        const noAuthRes = await request('/api/sequences/me');
        test('status 401', noAuthRes.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (testCompanyId) {
                await AuditLog.destroy({ where: { companyId: testCompanyId } });
                await Sequence.destroy({ where: { companyId: testCompanyId } });
                await Subscription.destroy({ where: { companyId: testCompanyId } });
                await User.destroy({ where: { companyId: testCompanyId } });
                await Company.destroy({ where: { id: testCompanyId } });
            }
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [testEmail, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();