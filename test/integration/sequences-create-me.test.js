require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999913';
let testEmail = 'owner-seq-create@expedinap.com';
let adminEmail = 'admin-seq-create@expedinap.com';
let testCompanyId = null;
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
            lastName: 'SeqCreate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Seq Create Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'SeqCreate' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: crear secuencia exitosamente
        // ============================================================
        console.log('--- Test 1: crear secuencia ---');
        const createRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                prefix: 'E',
                startNumber: '0000000001',
                endNumber: '0000001000',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 201', createRes.status === 201, `got ${createRes.status}`);
        test('has sequence', !!createRes.body?.data?.sequence);
        const createdSeq = createRes.body?.data?.sequence;
        test('type is 32', createdSeq?.type === '32');
        test('prefix is E', createdSeq?.prefix === 'E');
        test('startNumber is 1', Number(createdSeq?.startNumber) === 1);
        test('endNumber is 1000', Number(createdSeq?.endNumber) === 1000);
        test('currentNumber is 0', Number(createdSeq?.currentNumber) === 0);
        test('isActive is true', createdSeq?.isActive === true);
        test('hasBeenUsed is false', createdSeq?.hasBeenUsed === false);
        test('canBeEdited is true', createdSeq?.canBeEdited === true);
        test('canBeDeleted is true', createdSeq?.canBeDeleted === true);
        test('remainingNumbers is 1000', createdSeq?.remainingNumbers === 1000);
        test('totalNumbers is 1000', createdSeq?.totalNumbers === 1000);

        const sequenceId = createdSeq?.id;

        // ============================================================
        // TEST 2: rechazar formato incorrecto de startNumber
        // ============================================================
        console.log('\n--- Test 2: formato incorrecto de startNumber ---');
        const badFormatRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',
                startNumber: '1',  // ← no son 10 dígitos
                endNumber: '0000001000',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', badFormatRes.status === 400, `got ${badFormatRes.status}`);
        test('code VALIDATION_ERROR', badFormatRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 3: rechazar endNumber <= startNumber
        // ============================================================
        console.log('\n--- Test 3: endNumber <= startNumber ---');
        const badRangeRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',
                startNumber: '0000001000',
                endNumber: '0000000100',  // menor
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', badRangeRes.status === 400);
        test('code VALIDATION_ERROR', badRangeRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 4: rechazar rango solapado (mismo tipo 32)
        // ============================================================
        console.log('\n--- Test 4: rango solapado ---');
        const overlapRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',  // ← mismo tipo que la secuencia 1
                startNumber: '0000000500',  // dentro del rango existente
                endNumber: '0000001500',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 409', overlapRes.status === 409, `got ${overlapRes.status}`);
        test('code RANGE_OVERLAPS', overlapRes.body?.error?.code === 'RANGE_OVERLAPS');

        // ============================================================
        // TEST 5: crear otro tipo (no solapa)
        // ============================================================
        console.log('\n--- Test 5: crear otro tipo ---');
        const otherTypeRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',  // tipo diferente
                startNumber: '0000000001',
                endNumber: '0000000500',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 201', otherTypeRes.status === 201, `got ${otherTypeRes.status}`);

        // ============================================================
        // TEST 6: rango demasiado grande
        // ============================================================
        console.log('\n--- Test 6: rango demasiado grande ---');
        const tooBigRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                startNumber: '0000000001',
                endNumber: '9999999999',  // 10 mil millones, excede 1M
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', tooBigRes.status === 400);
        test('code RANGE_TOO_LARGE', tooBigRes.body?.error?.code === 'RANGE_TOO_LARGE');

        // ============================================================
        // TEST 7: type inválido
        // ============================================================
        console.log('\n--- Test 7: type inválido ---');
        const badTypeRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '99',
                startNumber: '0000000001',
                endNumber: '0000000100',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', badTypeRes.status === 400);

        // ============================================================
        // TEST 8: expiresAt en el pasado
        // ============================================================
        console.log('\n--- Test 8: expiresAt en el pasado ---');
        const pastExpiresRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                startNumber: '0000000001',
                endNumber: '0000000100',
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', pastExpiresRes.status === 400);

        // ============================================================
        // TEST 9: admin intenta crear → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 9: admin intenta crear ---');
        const adminRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                type: '32',
                startNumber: '0000000001',
                endNumber: '0000000100',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 10: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 10: sin autenticación ---');
        const noAuthRes = await request('/api/sequences/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: '32',
                startNumber: '0000000001',
                endNumber: '0000000100',
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 11: audit log creado
        // ============================================================
        console.log('\n--- Test 11: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'sequence.created',
                entity: 'sequence'
            }
        });
        test('at least 2 sequence.created logs', auditCount >= 2, `count: ${auditCount}`);

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
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();