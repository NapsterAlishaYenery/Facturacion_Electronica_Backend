require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999914';
let testEmail = 'owner-seq-update@expedinap.com';
let adminEmail = 'admin-seq-update@expedinap.com';
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
            lastName: 'SeqUpdate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Seq Update Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'SeqUpdate' }
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
        // TEST 1: actualizar expiresAt de secuencia no usada
        // ============================================================
        console.log('--- Test 1: actualizar expiresAt (no usada) ---');
        const newExpires = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // +2 años
        const expiresRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                expiresAt: newExpires.toISOString()
            })
        });
        test('status 200', expiresRes.status === 200, `got ${expiresRes.status}`);
        test('has sequence', !!expiresRes.body?.data?.sequence);
        test('expiresAt updated', new Date(expiresRes.body?.data?.sequence?.expiresAt).getTime() === newExpires.getTime());

        // ============================================================
        // TEST 2: actualizar rango de secuencia NO usada (permitido)
        // ============================================================
        console.log('\n--- Test 2: actualizar rango (no usada) ---');
        const rangeRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                startNumber: '0000000001',
                endNumber: '0000002000'
            })
        });
        test('status 200', rangeRes.status === 200, `got ${rangeRes.status}`);
        test('endNumber updated', Number(rangeRes.body?.data?.sequence?.endNumber) === 2000);
        test('totalNumbers is 2000', rangeRes.body?.data?.sequence?.totalNumbers === 2000);

        // ============================================================
        // TEST 3: intentar actualizar rango de secuencia USADA (rechazado)
        // ============================================================
        console.log('\n--- Test 3: actualizar rango (ya usada) → 409 ---');
        const immutableRes = await request(`/api/sequences/me/${usedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                endNumber: '0000001000'
            })
        });
        test('status 409', immutableRes.status === 409, `got ${immutableRes.status}`);
        test('code SEQUENCE_RANGE_IMMUTABLE', immutableRes.body?.error?.code === 'SEQUENCE_RANGE_IMMUTABLE');

        // ============================================================
        // TEST 4: actualizar expiresAt de secuencia USADA (permitido)
        // ============================================================
        console.log('\n--- Test 4: actualizar expiresAt (usada) ---');
        const usedExpiresRes = await request(`/api/sequences/me/${usedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                expiresAt: newExpires.toISOString()
            })
        });
        test('status 200', usedExpiresRes.status === 200, `got ${usedExpiresRes.status}`);

        // ============================================================
        // TEST 5: rango solapado con otra secuencia activa del mismo tipo
        // ============================================================
        console.log('\n--- Test 5: rango solapado ---');
        // Crear otra secuencia tipo 32 activa para testear solapamiento
        const otherSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 5000,
            endNumber: 6000,
            currentNumber: 4999,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        // Intentar editar unusedSeq para que se solape
        const overlapRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                startNumber: '0000005000',
                endNumber: '0000007000'
            })
        });
        test('status 409', overlapRes.status === 409, `got ${overlapRes.status}`);
        test('code RANGE_OVERLAPS', overlapRes.body?.error?.code === 'RANGE_OVERLAPS');

        // Limpiar
        await otherSeq.destroy();

        // ============================================================
        // TEST 6: body vacío → 400
        // ============================================================
        console.log('\n--- Test 6: body vacío ---');
        const emptyRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400);

        // ============================================================
        // TEST 7: endNumber <= startNumber → 400
        // ============================================================
        console.log('\n--- Test 7: endNumber <= startNumber ---');
        const badRangeRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                startNumber: '0000002000',
                endNumber: '0000001000'
            })
        });
        test('status 400', badRangeRes.status === 400);

        // ============================================================
        // TEST 8: secuencia de OTRA empresa → 404
        // ============================================================
        console.log('\n--- Test 8: secuencia de otra empresa ---');
        const otherCompany = await Company.create({ rnc: '130999999', name: 'Other Company' });
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
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                expiresAt: newExpires.toISOString()
            })
        });
        test('status 404', foreignRes.status === 404);
        test('code SEQUENCE_NOT_FOUND', foreignRes.body?.error?.code === 'SEQUENCE_NOT_FOUND');

        // Limpiar
        await foreignSeq.destroy();
        await otherCompany.destroy();

        // ============================================================
        // TEST 9: admin intenta actualizar → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 9: admin intenta actualizar ---');
        const adminRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                expiresAt: newExpires.toISOString()
            })
        });
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 10: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 10: sin autenticación ---');
        const noAuthRes = await request(`/api/sequences/me/${unusedSeqId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresAt: newExpires.toISOString() })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 11: audit log creado
        // ============================================================
        console.log('\n--- Test 11: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'sequence.updated',
                entity: 'sequence'
            }
        });
        test('at least 3 sequence.updated logs', auditCount >= 3, `count: ${auditCount}`);

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
            // Limpieza del "otherCompany" huérfano
            const otherCompany = await Company.findOne({ where: { rnc: '130999999' } });
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