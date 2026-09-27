require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc = '130999950';
let ownerEmail = 'owner-inv-get-admin@expedinap.com';
let adminEmail = 'admin-inv-get-admin@expedinap.com';
let testCompanyId = null;
let testSequenceId = null;
let invoiceId = null;
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

async function cleanupCompany(rnc) {
    const old = await Company.findOne({ where: { rnc } });
    if (old) {
        await AuditLog.destroy({ where: { companyId: old.id } });
        const invoices = await Invoice.findAll({ where: { companyId: old.id }, attributes: ['id'] });
        const ids = invoices.map(i => i.id);
        if (ids.length > 0) {
            await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: ids } } });
        }
        await Invoice.destroy({ where: { companyId: old.id } });
        await Sequence.destroy({ where: { companyId: old.id } });
        await Subscription.destroy({ where: { companyId: old.id } });
        await User.destroy({ where: { companyId: old.id } });
        await Company.destroy({ where: { id: old.id } });
    }
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await cleanupCompany(testRnc);
        await User.destroy({ where: { email: [ownerEmail, adminEmail] } });

        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'InvGetAdmin',
            role: 'admin'
        });
        adminId = adminUser.id;

        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Get Admin Test SRL' },
                owner: { email: ownerEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvGetAdmin' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        const seq = await Sequence.create({
            companyId: testCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequenceId = seq.id;

        // Crear factura con líneas
        const inv = await Invoice.create({
            companyId: testCompanyId,
            sequenceId: testSequenceId,
            type: '32',
            ncf: 'E320000000001',
            status: 'sent',
            trackId: 'TRACK999',
            issuerRnc: testRnc,
            issuerName: 'Get Admin Test SRL',
            receiverRnc: '130999888',
            receiverName: 'Cliente Admin',
            subtotal: 300,
            itbis: 54,
            total: 354,
            issuedAt: new Date(),
            xmlContent: '<ECF>test</ECF>',
            xmlSigned: '<ECF><Signature>signed</Signature></ECF>',
            dgiiResponse: { trackId: 'TRACK999', estado: 'Aceptado' }
        });
        invoiceId = inv.id;

        await InvoiceLine.bulkCreate([
            { invoiceId, lineNumber: 1, description: 'Line 1', quantity: 1, unitPrice: 100, itbisRate: 18, itbisAmount: 18, total: 118 },
            { invoiceId, lineNumber: 2, description: 'Line 2', quantity: 1, unitPrice: 200, itbisRate: 18, itbisAmount: 36, total: 236 }
        ]);

        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(ownerEmail, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin ve cualquier factura con todos los datos
        // ============================================================
        console.log('--- Test 1: admin ve factura ---');
        const getRes = await request(`/api/invoices/${invoiceId}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', getRes.status === 200, `got ${getRes.status}`);
        test('has invoice', !!getRes.body?.data?.invoice);

        const invDetail = getRes.body?.data?.invoice;
        test('invoice.id matches', invDetail?.id === invoiceId);
        test('invoice.ncf matches', invDetail?.ncf === 'E320000000001');
        test('invoice.status is sent', invDetail?.status === 'sent');
        test('has 2 lines', invDetail?.lines?.length === 2);
        test('lineCount is 2', invDetail?.lineCount === 2);
        test('lines ordered by lineNumber', 
            invDetail?.lines?.[0]?.lineNumber === 1 && invDetail?.lines?.[1]?.lineNumber === 2);

        // ============================================================
        // TEST 2: include de company con datos
        // ============================================================
        console.log('\n--- Test 2: include de company ---');
        test('has company include', !!invDetail?.company);
        test('company.rnc matches', invDetail?.company?.rnc === testRnc);
        test('company.name matches', invDetail?.company?.name === 'Get Admin Test SRL');
        test('company does NOT expose certificatePasswordEncrypted', 
            invDetail?.company?.certificatePasswordEncrypted === undefined);

        // ============================================================
        // TEST 3: include de sequence
        // ============================================================
        console.log('\n--- Test 3: include de sequence ---');
        test('has sequence include', !!invDetail?.sequence);
        test('sequence.id matches', invDetail?.sequence?.id === testSequenceId);
        test('sequence.type is 32', invDetail?.sequence?.type === '32');

        // ============================================================
        // TEST 4: SÍ expone XML y dgiiResponse (detalle admin)
        // ============================================================
        console.log('\n--- Test 4: expone XML en detalle admin ---');
        test('has xmlContent', invDetail?.xmlContent === '<ECF>test</ECF>');
        test('has xmlSigned', invDetail?.xmlSigned === '<ECF><Signature>signed</Signature></ECF>');
        test('has dgiiResponse', !!invDetail?.dgiiResponse);
        test('dgiiResponse.estado is Aceptado', invDetail?.dgiiResponse?.estado === 'Aceptado');

        // ============================================================
        // TEST 5: campos calculados
        // ============================================================
        console.log('\n--- Test 5: campos calculados ---');
        test('isSent true', invDetail?.isSent === true);
        test('canBeSigned false (already sent)', invDetail?.canBeSigned === false);
        test('canBeSent false (already sent)', invDetail?.canBeSent === false);
        test('canEdit false', invDetail?.canEdit === false);
        test('hasTrackId true', invDetail?.hasTrackId === true);

        // ============================================================
        // TEST 6: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 6: ID inexistente ---');
        const notFoundRes = await request('/api/invoices/00000000-0000-0000-0000-000000000000', {
            headers: { Cookie: adminCookie }
        });
        test('status 404', notFoundRes.status === 404);
        test('code INVOICE_NOT_FOUND', notFoundRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 7: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 7: ID malformado ---');
        const badIdRes = await request('/api/invoices/not-a-uuid', {
            headers: { Cookie: adminCookie }
        });
        test('status 400', badIdRes.status === 400);

        // ============================================================
        // TEST 8: company_admin NO puede usar esta ruta
        // ============================================================
        console.log('\n--- Test 8: company_admin intenta ---');
        const forbiddenRes = await request(`/api/invoices/${invoiceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 9: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 9: sin autenticación ---');
        const noAuthRes = await request(`/api/invoices/${invoiceId}`);
        test('status 401', noAuthRes.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await cleanupCompany(testRnc);
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [ownerEmail, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();