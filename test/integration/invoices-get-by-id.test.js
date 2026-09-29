require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let otherCompanyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999921';
let otherRnc = '130999922';
let testEmail = 'owner-inv-get@expedinap.com';
let otherEmail = 'other-inv-get@expedinap.com';
let adminEmail = 'admin-inv-get@expedinap.com';
let testCompanyId = null;
let otherCompanyId = null;
let testSequenceId = null;
let invoiceId = null;
let otherInvoiceId = null;
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

        // Limpieza previa
        await cleanupCompany(testRnc);
        await cleanupCompany(otherRnc);
        await User.destroy({ where: { email: [testEmail, otherEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'InvGet',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa 1 + dueño
        const res1 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Get Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvGet' }
            })
        });
        testCompanyId = res1.body?.data?.company?.id;

        // Crear empresa 2 + dueño
        const res2 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: otherRnc, name: 'Other Invoices SRL' },
                owner: { email: otherEmail, password: 'OwnerPass123', firstName: 'Other', lastName: 'Owner' }
            })
        });
        otherCompanyId = res2.body?.data?.company?.id;

        // Crear secuencia para empresa 1
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

        // Crear secuencia para empresa 2
        const otherSeq = await Sequence.create({
            companyId: otherCompanyId,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 500,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        // Crear factura con líneas (empresa 1)
        const invoiceCreated = await Invoice.create({
            companyId: testCompanyId,
            sequenceId: testSequenceId,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: testRnc,
            issuerName: 'Invoices Get Test SRL',
            receiverRnc: '130999888',
            receiverName: 'Cliente XYZ',
            subtotal: 200,
            itbis: 36,
            total: 236,
            issuedAt: new Date(),
            xmlContent: '<ECF>test content</ECF>'
        });
        invoiceId = invoiceCreated.id;

        // Agregar 3 líneas
        await InvoiceLine.bulkCreate([
            { invoiceId, lineNumber: 3, description: 'Item 3', quantity: 1, unitPrice: 100, itbisRate: 18, itbisAmount: 18, total: 118 },
            { invoiceId, lineNumber: 1, description: 'Item 1', quantity: 1, unitPrice: 50, itbisRate: 18, itbisAmount: 9, total: 59 },
            { invoiceId, lineNumber: 2, description: 'Item 2', quantity: 1, unitPrice: 50, itbisRate: 18, itbisAmount: 9, total: 59 }
        ]);

        // Crear factura en otra empresa (para test de aislamiento)
        const otherInv = await Invoice.create({
            companyId: otherCompanyId,
            sequenceId: otherSeq.id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: otherRnc,
            issuerName: 'Other Invoices SRL',
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: new Date()
        });
        otherInvoiceId = otherInv.id;

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        otherCompanyAdminCookie = await loginAndGetCookie(otherEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: company_admin ve su factura con líneas ordenadas
        // ============================================================
        console.log('--- Test 1: ver factura con líneas ---');
        const getRes = await request(`/api/invoices/me/${invoiceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', getRes.status === 200, `got ${getRes.status}`);
        test('has invoice', !!getRes.body?.data?.invoice);
        test('invoice.id matches', getRes.body?.data?.invoice?.id === invoiceId);
        test('has lines array', Array.isArray(getRes.body?.data?.invoice?.lines));
        test('has 3 lines', getRes.body?.data?.invoice?.lines?.length === 3);
        test('lineCount is 3', getRes.body?.data?.invoice?.lineCount === 3);

        // Verificar orden de líneas
        const lines = getRes.body?.data?.invoice?.lines || [];
        test('lines ordered by lineNumber ASC',
            lines[0]?.lineNumber === 1 && lines[1]?.lineNumber === 2 && lines[2]?.lineNumber === 3);
        test('first line description', lines[0]?.description === 'Item 1');
        test('last line description', lines[2]?.description === 'Item 3');

        // ============================================================
        // TEST 2: verificar campos del detalle
        // ============================================================
        console.log('\n--- Test 2: campos del detalle ---');
        const inv = getRes.body?.data?.invoice;
        test('has xmlContent (detail sí expone)', inv?.xmlContent === '<ECF>test content</ECF>');
        test('has receiverRnc', inv?.receiverRnc === '130999888');
        test('has receiverName', inv?.receiverName === 'Cliente XYZ');
        test('has sequence include', !!inv?.sequence);
        test('sequence.id matches', inv?.sequence?.id === testSequenceId);
        test('sequence has currentNumber', inv?.sequence?.currentNumber !== undefined);
        test('isDraft true', inv?.isDraft === true);
        test('canBeSigned true', inv?.canBeSigned === true);
        test('canBeSent false', inv?.canBeSent === false);
        test('canEdit true', inv?.canEdit === true);

        // 🔥 NUEVO: flags por tipo
        test('inv has isNota false', inv?.isNota === false);
        test('inv has isDebitNote false', inv?.isDebitNote === false);
        test('inv has isCreditNote false', inv?.isCreditNote === false);
        test('inv has typeName Factura de Consumo', inv?.typeName === 'Factura de Consumo Electrónica');
        test('inv has hasModificationReference false', inv?.hasModificationReference === false);
        test('inv has canEditReference false', inv?.canEditReference === false);

        // ============================================================
        // TEST 3: aislamiento multi-tenant
        // ============================================================
        console.log('\n--- Test 3: aislamiento multi-tenant ---');
        const foreignRes = await request(`/api/invoices/me/${otherInvoiceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', foreignRes.status === 404, `got ${foreignRes.status}`);
        test('code INVOICE_NOT_FOUND', foreignRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 4: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 4: ID inexistente → 404 ---');
        const notFoundRes = await request('/api/invoices/me/00000000-0000-0000-0000-000000000000', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', notFoundRes.status === 404);
        test('code INVOICE_NOT_FOUND', notFoundRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 5: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 5: ID malformado → 400 ---');
        const badIdRes = await request('/api/invoices/me/not-a-uuid', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);

        // ============================================================
        // TEST 6: canBeSigned/canBeSent según estado
        // ============================================================
        console.log('\n--- Test 6: canBeSigned/canBeSent ---');
        // Cambiar a status sent
        await invoiceCreated.update({ status: 'sent' });

        const sentRes = await request(`/api/invoices/me/${invoiceId}`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('sent invoice canBeSigned false', sentRes.body?.data?.invoice?.canBeSigned === false);
        test('sent invoice canBeSent false', sentRes.body?.data?.invoice?.canBeSent === false);
        test('sent invoice canEdit false', sentRes.body?.data?.invoice?.canEdit === false);
        test('sent invoice isSent true', sentRes.body?.data?.invoice?.isSent === true);

        // Restaurar a draft
        await invoiceCreated.update({ status: 'draft' });

        // ============================================================
        // TEST 7: admin intenta usar /me/:id → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 7: admin intenta /me/:id ---');
        const adminRes = await request(`/api/invoices/me/${invoiceId}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminRes.status === 400, `got ${adminRes.status}`);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 8: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 8: sin autenticación ---');
        const noAuthRes = await request(`/api/invoices/me/${invoiceId}`);
        test('status 401', noAuthRes.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await cleanupCompany(testRnc);
            await cleanupCompany(otherRnc);
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