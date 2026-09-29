require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999920';
let testEmail = 'owner-inv-list@expedinap.com';
let adminEmail = 'admin-inv-list@expedinap.com';
let testCompanyId = null;
let testSequenceId = null;
let adminId = null;
let invoice1Id = null;
let invoice2Id = null;
let invoice3Id = null;

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
            await InvoiceLine.destroy({ where: { invoiceId: { [require('sequelize').Op.in]: (await Invoice.findAll({ where: { companyId: oldCompany.id }, attributes: ['id'] })).map(i => i.id) } } });
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
            lastName: 'InvList',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices List Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvList' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Crear secuencia
        const seq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequenceId = seq.id;

        // Crear 3 facturas con distintos estados
        const now = new Date();
        const inv1 = await Invoice.create({
            companyId: testCompanyId,
            sequenceId: testSequenceId,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: testRnc,
            issuerName: 'Invoices List Test SRL',
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: now
        });
        invoice1Id = inv1.id;

        const inv2 = await Invoice.create({
            companyId: testCompanyId,
            sequenceId: testSequenceId,
            type: '32',
            ncf: 'E320000000002',
            status: 'sent',
            trackId: 'TRACK123',
            issuerRnc: testRnc,
            issuerName: 'Invoices List Test SRL',
            receiverRnc: '130999888',
            receiverName: 'Cliente B2B',
            subtotal: 200,
            itbis: 36,
            total: 236,
            issuedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // ayer
        });
        invoice2Id = inv2.id;

        const inv3 = await Invoice.create({
            companyId: testCompanyId,
            sequenceId: testSequenceId,
            type: '31',
            ncf: 'E310000000001',
            status: 'accepted',
            trackId: 'TRACK456',
            issuerRnc: testRnc,
            issuerName: 'Invoices List Test SRL',
            receiverRnc: '130999777',
            receiverName: 'Otro Cliente',
            subtotal: 300,
            itbis: 54,
            total: 354,
            issuedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // hace 7 días
        });
        invoice3Id = inv3.id;

        // Agregar líneas a la primera factura
        await InvoiceLine.bulkCreate([
            { invoiceId: invoice1Id, lineNumber: 1, description: 'Item 1', quantity: 1, unitPrice: 50, itbisRate: 18, itbisAmount: 9, total: 59 },
            { invoiceId: invoice1Id, lineNumber: 2, description: 'Item 2', quantity: 1, unitPrice: 50, itbisRate: 18, itbisAmount: 9, total: 59 }
        ]);

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin lista sus facturas
        // ============================================================
        console.log('--- Test 1: listar facturas ---');
        const listRes = await request('/api/invoices/me', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('has pagination', typeof listRes.body?.data?.pagination === 'object');
        test('totalItems is 3', listRes.body?.data?.pagination?.totalItems === 3);

        const items = listRes.body?.data?.items || [];
        const inv1Item = items.find(i => i.id === invoice1Id);

        // Verificar campos calculados
        test('inv1 has lineCount 2', inv1Item?.lineCount === 2, `got ${inv1Item?.lineCount}`);
        test('inv1 isDraft true', inv1Item?.isDraft === true);
        test('inv1 canEdit true', inv1Item?.canEdit === true);
        test('inv1 hasTrackId false', inv1Item?.hasTrackId === false);
        test('inv1 does NOT expose xmlContent', inv1Item?.xmlContent === undefined);
        test('inv1 does NOT expose xmlSigned', inv1Item?.xmlSigned === undefined);
        test('inv1 has sequence include', !!inv1Item?.sequence);
        test('inv1 sequence.type is 32', inv1Item?.sequence?.type === '32');

        // Verificar factura enviada
        const inv2Item = items.find(i => i.id === invoice2Id);
        test('inv2 isSent true', inv2Item?.isSent === true);
        test('inv2 canEdit false', inv2Item?.canEdit === false);
        test('inv2 hasTrackId true', inv2Item?.hasTrackId === true);

        // ============================================================
        // TEST 2: filtro por status
        // ============================================================
        console.log('\n--- Test 2: filtro status ---');
        const draftRes = await request('/api/invoices/me?status=draft', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', draftRes.status === 200);
        test('all items draft', draftRes.body?.data?.items?.every(i => i.status === 'draft'));
        test('returns 1 item', draftRes.body?.data?.items?.length === 1);

        // ============================================================
        // TEST 3: filtro por type
        // ============================================================
        console.log('\n--- Test 3: filtro type ---');
        const type31Res = await request('/api/invoices/me?type=31', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', type31Res.status === 200);
        test('all items type 31', type31Res.body?.data?.items?.every(i => i.type === '31'));

        // ============================================================
        // TEST 4: filtro hasTrackId
        // ============================================================
        console.log('\n--- Test 4: filtro hasTrackId ---');
        const trackRes = await request('/api/invoices/me?hasTrackId=true', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', trackRes.status === 200);
        test('all items have trackId', trackRes.body?.data?.items?.every(i => i.trackId));

        // ============================================================
        // TEST 5: filtro receiverRnc
        // ============================================================
        console.log('\n--- Test 5: filtro receiverRnc ---');
        const receiverRes = await request('/api/invoices/me?receiverRnc=130999888', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', receiverRes.status === 200);
        test('returns 1 item', receiverRes.body?.data?.items?.length === 1);
        test('item matches receiverRnc', receiverRes.body?.data?.items?.[0]?.receiverRnc === '130999888');

        // ============================================================
        // TEST 6: filtro ncf
        // ============================================================
        console.log('\n--- Test 6: filtro ncf ---');
        const ncfRes = await request('/api/invoices/me?ncf=E320000000001', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', ncfRes.status === 200);
        test('returns 1 item', ncfRes.body?.data?.items?.length === 1);
        test('item matches ncf', ncfRes.body?.data?.items?.[0]?.ncf === 'E320000000001');

        // ============================================================
        // TEST 7: filtro fromDate
        // ============================================================
        console.log('\n--- Test 7: filtro fromDate ---');
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const fromDateRes = await request(`/api/invoices/me?fromDate=${twoDaysAgo}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', fromDateRes.status === 200);
        test('excludes older invoice (7 days ago)', !fromDateRes.body?.data?.items?.some(i => i.id === invoice3Id));
        test('includes recent invoice', fromDateRes.body?.data?.items?.some(i => i.id === invoice1Id));

        // ============================================================
        // TEST 8: paginación
        // ============================================================
        console.log('\n--- Test 8: paginación ---');
        const pagRes = await request('/api/invoices/me?limit=1&page=1', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', pagRes.status === 200);
        test('returns 1 item', pagRes.body?.data?.items?.length === 1);
        test('hasNextPage true', pagRes.body?.data?.pagination?.hasNextPage === true);
        test('totalPages is 3', pagRes.body?.data?.pagination?.totalPages === 3);

        // ============================================================
        // TEST 9: admin intenta usar /me → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 9: admin intenta /me ---');
        const adminMeRes = await request('/api/invoices/me', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminMeRes.status === 400, `got ${adminMeRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminMeRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 10: filtros inválidos → 400
        // ============================================================
        console.log('\n--- Test 10: filtros inválidos ---');
        const badStatusRes = await request('/api/invoices/me?status=invalid', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', badStatusRes.status === 400);
        test('code VALIDATION_ERROR', badStatusRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 11: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 11: sin autenticación ---');
        const noAuthRes = await request('/api/invoices/me');
        test('status 401', noAuthRes.status === 401);
        // 🔥 NUEVO: flags por tipo (listado)
        test('inv1 has isNota false', inv1Item?.isNota === false);
        test('inv1 has typeName', inv1Item?.typeName === 'Factura de Consumo Electrónica');
        test('inv1 has canEditReference false', inv1Item?.canEditReference === false);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (testCompanyId) {
                await AuditLog.destroy({ where: { companyId: testCompanyId } });
                const invoices = await Invoice.findAll({ where: { companyId: testCompanyId }, attributes: ['id'] });
                const invoiceIds = invoices.map(i => i.id);
                if (invoiceIds.length > 0) {
                    await InvoiceLine.destroy({ where: { invoiceId: { [require('sequelize').Op.in]: invoiceIds } } });
                }
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