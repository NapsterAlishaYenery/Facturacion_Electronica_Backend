require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999915';
let testEmail = 'owner-seq-activate@expedinap.com';
let adminEmail = 'admin-seq-activate@expedinap.com';
let testCompanyId = null;
let adminId = null;
let activeSeqId = null;
let expiredSeqId = null;
let exhaustedSeqId = null;

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
            await Invoice.destroy({ where: { companyId: oldCompany.id } });
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
            lastName: 'SeqActivate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Seq Activate Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'SeqActivate' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Crear 3 secuencias: activa, vencida, agotada
        const activeSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 100,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        activeSeqId = activeSeq.id;

        const expiredSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 0,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // ayer
            isActive: false
        });
        expiredSeqId = expiredSeq.id;

        const exhaustedSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '33',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 100, // agotada
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: false
        });
        exhaustedSeqId = exhaustedSeq.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: desactivar secuencia activa
        // ============================================================
        console.log('--- Test 1: desactivar secuencia activa ---');
        const deactivateRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 200', deactivateRes.status === 200, `got ${deactivateRes.status}`);
        test('isActive is false', deactivateRes.body?.data?.sequence?.isActive === false);
        test('message says deactivated', deactivateRes.body?.message?.includes('deactivated'));

        // ============================================================
        // TEST 2: reactivar la misma secuencia
        // ============================================================
        console.log('\n--- Test 2: reactivar secuencia ---');
        const activateRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 200', activateRes.status === 200);
        test('isActive is true', activateRes.body?.data?.sequence?.isActive === true);
        test('message says activated', activateRes.body?.message?.includes('activated'));

        // ============================================================
        // TEST 3: idempotencia (activar ya activa)
        // ============================================================
        console.log('\n--- Test 3: idempotencia ---');
        const idempotentRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 200', idempotentRes.status === 200);
        test('isActive still true', idempotentRes.body?.data?.sequence?.isActive === true);

        // ============================================================
        // TEST 4: intentar activar secuencia vencida → 409
        // ============================================================
        console.log('\n--- Test 4: activar vencida → 409 ---');
        const expiredRes = await request(`/api/sequences/me/${expiredSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 409', expiredRes.status === 409, `got ${expiredRes.status}`);
        test('code SEQUENCE_EXPIRED', expiredRes.body?.error?.code === 'SEQUENCE_EXPIRED');

        // ============================================================
        // TEST 5: intentar activar secuencia agotada → 409
        // ============================================================
        console.log('\n--- Test 5: activar agotada → 409 ---');
        const exhaustedRes = await request(`/api/sequences/me/${exhaustedSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 409', exhaustedRes.status === 409, `got ${exhaustedRes.status}`);
        test('code SEQUENCE_EXHAUSTED', exhaustedRes.body?.error?.code === 'SEQUENCE_EXHAUSTED');

        // ============================================================
        // TEST 6: isActive inválido → 400
        // ============================================================
        console.log('\n--- Test 6: isActive inválido ---');
        const invalidRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: 'not-a-bool' })
        });
        test('status 400', invalidRes.status === 400);

        // ============================================================
        // TEST 7: body sin isActive → 400
        // ============================================================
        console.log('\n--- Test 7: body sin isActive ---');
        const emptyRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400);

        // ============================================================
        // TEST 8: secuencia de otra empresa → 404
        // ============================================================
        console.log('\n--- Test 8: secuencia de otra empresa ---');
        const otherCompany = await Company.create({ rnc: '130999888', name: 'Other Company' });
        const foreignSeq = await Sequence.create({
            companyId: otherCompany.id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        const foreignRes = await request(`/api/sequences/me/${foreignSeq.id}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 404', foreignRes.status === 404);
        test('code SEQUENCE_NOT_FOUND', foreignRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        await foreignSeq.destroy();
        await otherCompany.destroy();

        // ============================================================
        // TEST 9: admin intenta activar/desactivar → 400
        // ============================================================
        console.log('\n--- Test 9: admin intenta activar ---');
        const adminRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: false })
        });
        test('status 400', adminRes.status === 400);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 10: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 10: sin autenticación ---');
        const noAuthRes = await request(`/api/sequences/me/${activeSeqId}/activate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: false })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 11: audit log con acciones específicas
        // ============================================================
        console.log('\n--- Test 11: audit log ---');
        const deactivatedCount = await AuditLog.count({
            where: { companyId: testCompanyId, action: 'sequence.deactivated' }
        });
        const activatedCount = await AuditLog.count({
            where: { companyId: testCompanyId, action: 'sequence.activated' }
        });
        test('has sequence.deactivated log', deactivatedCount >= 1, `count: ${deactivatedCount}`);
        test('has sequence.activated log', activatedCount >= 1, `count: ${activatedCount}`);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (testCompanyId) {
                await AuditLog.destroy({ where: { companyId: testCompanyId } });
                await Invoice.destroy({ where: { companyId: testCompanyId } });
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
            // Cleanup de compañía huérfana si quedó
            const otherCompany = await Company.findOne({ where: { rnc: '130999888' } });
            if (otherCompany) {
                await Sequence.destroy({ where: { companyId: otherCompany.id } });
                await Company.destroy({ where: { id: otherCompany.id } });
            }
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();