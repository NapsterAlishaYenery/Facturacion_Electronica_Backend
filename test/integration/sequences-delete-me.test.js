require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999916';
let testEmail = 'owner-seq-delete@expedinap.com';
let adminEmail = 'admin-seq-delete@expedinap.com';
let testCompanyId = null;
let adminId = null;
let unusedSeqId = null;
let usedSeqId = null;

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
            lastName: 'SeqDelete',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Seq Delete Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'SeqDelete' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Crear 2 secuencias: una sin usar, una ya usada
        const unusedSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 0,  // ← nunca usado
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        unusedSeqId = unusedSeq.id;

        const usedSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 50,  // ← ya usado
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        usedSeqId = usedSeq.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: borrar secuencia NO usada
        // ============================================================
        console.log('--- Test 1: borrar secuencia NO usada ---');
        const deleteRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 200', deleteRes.status === 200, `got ${deleteRes.status}`);
        test('deleted is true', deleteRes.body?.data?.deleted === true);
        test('has before data', !!deleteRes.body?.data?.before);
        test('before.type is 32', deleteRes.body?.data?.before?.type === '32');
        test('before.startNumber is 1', deleteRes.body?.data?.before?.startNumber === 1);

        // Verificar que ya no existe en BD
        const afterDelete = await Sequence.findByPk(unusedSeqId);
        test('sequence no longer exists in DB', afterDelete === null);

        // ============================================================
        // TEST 2: intentar borrar secuencia YA usada → 409
        // ============================================================
        console.log('\n--- Test 2: borrar secuencia usada → 409 ---');
        const usedRes = await request(`/api/sequences/me/${usedSeqId}`, {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 409', usedRes.status === 409, `got ${usedRes.status}`);
        test('code SEQUENCE_HAS_INVOICES', usedRes.body?.error?.code === 'SEQUENCE_HAS_INVOICES');

        // Verificar que sigue existiendo
        const stillExists = await Sequence.findByPk(usedSeqId);
        test('sequence still exists in DB', stillExists !== null);

        // ============================================================
        // TEST 3: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 3: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/sequences/me/00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 404', notFoundRes.status === 404);
        test('code SEQUENCE_NOT_FOUND', notFoundRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        // ============================================================
        // TEST 4: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 4: ID malformado → 400 ---');
        const badIdRes = await request('/api/sequences/me/not-a-uuid', {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);

        // ============================================================
        // TEST 5: secuencia de OTRA empresa → 404
        // ============================================================
        console.log('\n--- Test 5: secuencia de otra empresa ---');
        const otherCompany = await Company.create({ rnc: '130999777', name: 'Other Company' });
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

        const foreignRes = await request(`/api/sequences/me/${foreignSeq.id}`, {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 404', foreignRes.status === 404);
        test('code SEQUENCE_NOT_FOUND', foreignRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        // Verificar que sigue existiendo
        const foreignStillExists = await Sequence.findByPk(foreignSeq.id);
        test('foreign sequence still exists', foreignStillExists !== null);

        await foreignSeq.destroy();
        await otherCompany.destroy();

        // ============================================================
        // TEST 6: admin intenta borrar → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 6: admin intenta borrar ---');
        // Crear otra sin usar para el test
        const anotherUnusedSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '34',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        const adminRes = await request(`/api/sequences/me/${anotherUnusedSeq.id}`, {
            method: 'DELETE',
            headers: { 'Cookie': adminCookie }
        });
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // Limpiar
        await anotherUnusedSeq.destroy();

        // ============================================================
        // TEST 7: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 7: sin autenticación ---');
        const noAuthRes = await request(`/api/sequences/me/${usedSeqId}`, {
            method: 'DELETE'
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 8: audit log creado
        // ============================================================
        console.log('\n--- Test 8: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'sequence.deleted',
                entity: 'sequence'
            }
        });
        test('has sequence.deleted log', auditCount >= 1, `count: ${auditCount}`);

        // Verificar que conserva el before data
        const auditLog = await AuditLog.findOne({
            where: {
                companyId: testCompanyId,
                action: 'sequence.deleted',
                entityId: unusedSeqId
            }
        });
        test('audit log has entityId', auditLog?.entityId === unusedSeqId);
        test('audit log has before.type', auditLog?.before?.type === '32');

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
            // Cleanup huérfano
            const otherCompany = await Company.findOne({ where: { rnc: '130999777' } });
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