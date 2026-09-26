require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let otherCompanyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999911';
let otherRnc = '130999912';
let testEmail = 'owner-seq-get@expedinap.com';
let otherEmail = 'other-seq-get@expedinap.com';
let adminEmail = 'admin-seq-get@expedinap.com';
let testCompanyId = null;
let otherCompanyId = null;
let testSequenceId = null;
let otherSequenceId = null;
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
        for (const rnc of [testRnc, otherRnc]) {
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
        await User.destroy({ where: { email: [testEmail, otherEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'SeqGet',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño principal
        const res1 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Seq Get Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'SeqGet' }
            })
        });
        testCompanyId = res1.body?.data?.company?.id;

        // Crear otra empresa + dueño
        const res2 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: otherRnc, name: 'Other Seq Company SRL' },
                owner: { email: otherEmail, password: 'OwnerPass123', firstName: 'Other', lastName: 'Owner' }
            })
        });
        otherCompanyId = res2.body?.data?.company?.id;

        // Crear secuencias
        const testSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 50,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequenceId = testSeq.id;

        const otherSeq = await Sequence.create({
            companyId: otherCompanyId,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        otherSequenceId = otherSeq.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        otherCompanyAdminCookie = await loginAndGetCookie(otherEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin ve su propia secuencia
        // ============================================================
        console.log('--- Test 1: company_admin ve su secuencia ---');
        const getRes = await request(`/api/sequences/me/${testSequenceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', getRes.status === 200, `got ${getRes.status}`);
        test('has sequence', !!getRes.body?.data?.sequence);
        test('sequence.id matches', getRes.body?.data?.sequence?.id === testSequenceId);
        test('sequence.type is 32', getRes.body?.data?.sequence?.type === '32');
        test('sequence.prefix is E', getRes.body?.data?.sequence?.prefix === 'E');
        test('startNumber is 1', Number(getRes.body?.data?.sequence?.startNumber) === 1);
        test('endNumber is 1000', Number(getRes.body?.data?.sequence?.endNumber) === 1000);
        test('currentNumber is 50', Number(getRes.body?.data?.sequence?.currentNumber) === 50);

        // ============================================================
        // TEST 2: campos calculados
        // ============================================================
        console.log('\n--- Test 2: campos calculados ---');
        const seq = getRes.body?.data?.sequence;
        test('isExpired is false', seq?.isExpired === false);
        test('remainingNumbers is 950', seq?.remainingNumbers === 950, `got ${seq?.remainingNumbers}`);
        test('totalNumbers is 1000', seq?.totalNumbers === 1000);
        test('usedPercentage is 5', seq?.usedPercentage === 5, `got ${seq?.usedPercentage}`);
        test('invoicesCount is 0', seq?.invoicesCount === 0);
        test('hasBeenUsed is true', seq?.hasBeenUsed === true);
        test('canBeEdited is false', seq?.canBeEdited === false);
        test('canBeDeleted is false', seq?.canBeDeleted === false);

        // ============================================================
        // TEST 3: company_admin NO puede ver secuencia de otra empresa
        // ============================================================
        console.log('\n--- Test 3: aislamiento multi-tenant ---');
        const foreignRes = await request(`/api/sequences/me/${otherSequenceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', foreignRes.status === 404, `got ${foreignRes.status}`);
        test('code SEQUENCE_NOT_FOUND', foreignRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        // ============================================================
        // TEST 4: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 4: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/sequences/me/00000000-0000-0000-0000-000000000000', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', notFoundRes.status === 404);
        test('code SEQUENCE_NOT_FOUND', notFoundRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        // ============================================================
        // TEST 5: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 5: ID malformado → 400 ---');
        const badIdRes = await request('/api/sequences/me/not-a-uuid', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);

        // ============================================================
        // TEST 6: secuencia no usada → canBeEdited y canBeDeleted true
        // ============================================================
        console.log('\n--- Test 6: secuencia no usada ---');
        const unusedSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '34',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,  // nunca usada
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        const unusedRes = await request(`/api/sequences/me/${unusedSeq.id}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', unusedRes.status === 200);
        test('hasBeenUsed is false', unusedRes.body?.data?.sequence?.hasBeenUsed === false);
        test('canBeEdited is true', unusedRes.body?.data?.sequence?.canBeEdited === true);
        test('canBeDeleted is true', unusedRes.body?.data?.sequence?.canBeDeleted === true);

        // Limpiar
        await unusedSeq.destroy();

        // ============================================================
        // TEST 7: admin intenta usar /me/:id → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 7: admin intenta /me/:id ---');
        const adminRes = await request(`/api/sequences/me/${testSequenceId}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 8: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 8: sin autenticación ---');
        const noAuthRes = await request(`/api/sequences/me/${testSequenceId}`);
        test('status 401', noAuthRes.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            for (const id of [testCompanyId, otherCompanyId]) {
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
            await User.destroy({ where: { email: [testEmail, otherEmail, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();