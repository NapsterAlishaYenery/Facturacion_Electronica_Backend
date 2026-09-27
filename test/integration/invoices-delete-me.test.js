require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999932';
let testEmail = 'owner-inv-delete@expedinap.com';
let adminEmail = 'admin-inv-delete@expedinap.com';
let testCompanyId = null;
let testSequenceId = null;
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

async function createTestInvoice(cookie) {
    const res = await request('/api/invoices/me', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            type: '32',
            receiverName: 'Cliente Delete',
            items: [
                { description: 'Item 1', quantity: 1, unitPrice: 100, itbisRate: 18 }
            ]
        })
    });
    return res.body?.data?.invoice;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await cleanupCompany(testRnc);
        await User.destroy({ where: { email: [testEmail, adminEmail] } });

        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'InvDelete',
            role: 'admin'
        });
        adminId = adminUser.id;

        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Delete Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvDelete' }
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

        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: borrar draft exitosamente
        // ============================================================
        console.log('--- Test 1: borrar draft ---');
        const inv1 = await createTestInvoice(companyAdminCookie);
        test('invoice created', !!inv1?.id);

        // Verificar que tiene líneas
        const linesBefore = await InvoiceLine.count({ where: { invoiceId: inv1.id } });
        test('has lines before delete', linesBefore >= 1, `count: ${linesBefore}`);

        const deleteRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', deleteRes.status === 200, `got ${deleteRes.status}`);
        test('deleted is true', deleteRes.body?.data?.deleted === true);
        test('has before data', !!deleteRes.body?.data?.before);
        test('before.ncf matches', deleteRes.body?.data?.before?.ncf === inv1.ncf);
        test('has note about NCF', !!deleteRes.body?.data?.note);

        // Verificar que se borró
        const invoiceAfter = await Invoice.findByPk(inv1.id);
        test('invoice no longer exists', invoiceAfter === null);

        // Verificar CASCADE en líneas
        const linesAfter = await InvoiceLine.count({ where: { invoiceId: inv1.id } });
        test('lines deleted (CASCADE)', linesAfter === 0);

        // ============================================================
        // TEST 2: NCF consumido NO se revierte
        // ============================================================
        console.log('\n--- Test 2: currentNumber NO revertido ---');
        const seqAfterDelete = await Sequence.findByPk(testSequenceId);
        test('currentNumber still 1 (NCF burned)', Number(seqAfterDelete.currentNumber) === 1, `got ${seqAfterDelete.currentNumber}`);

        // ============================================================
        // TEST 3: crear otra factura → NCF siguiente
        // ============================================================
        console.log('\n--- Test 3: siguiente NCF después de borrar ---');
        const inv2 = await createTestInvoice(companyAdminCookie);
        test('new invoice ncf is 002', inv2?.ncf === 'E320000000002', `got ${inv2?.ncf}`);

        // ============================================================
        // TEST 4: no borrar factura con status !== draft
        // ============================================================
        console.log('\n--- Test 4: factura enviada no borrable ---');
        await Invoice.update({ status: 'sent', trackId: 'TRACK123' }, { where: { id: inv2.id } });

        const sentRes = await request(`/api/invoices/me/${inv2.id}`, {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 409', sentRes.status === 409, `got ${sentRes.status}`);
        test('code INVOICE_NOT_DELETABLE', sentRes.body?.error?.code === 'INVOICE_NOT_DELETABLE');

        // Verificar que sigue existiendo
        const stillExists = await Invoice.findByPk(inv2.id);
        test('invoice still exists', stillExists !== null);

        // ============================================================
        // TEST 5: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 5: ID inexistente ---');
        const notFoundRes = await request('/api/invoices/me/00000000-0000-0000-0000-000000000000', {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', notFoundRes.status === 404);
        test('code INVOICE_NOT_FOUND', notFoundRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 6: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 6: ID malformado ---');
        const badIdRes = await request('/api/invoices/me/not-a-uuid', {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', badIdRes.status === 400);

        // ============================================================
        // TEST 7: aislamiento multi-tenant → 404
        // ============================================================
        console.log('\n--- Test 7: otra empresa ---');
        const otherCompany = await Company.create({ rnc: '130999998', name: 'Other' });
        const otherSeq = await Sequence.create({
            companyId: otherCompany.id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        const foreignInv = await Invoice.create({
            companyId: otherCompany.id,
            sequenceId: otherSeq.id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: '130999998',
            issuerName: 'Other',
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: new Date()
        });

        const foreignRes = await request(`/api/invoices/me/${foreignInv.id}`, {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', foreignRes.status === 404);
        test('code INVOICE_NOT_FOUND', foreignRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        await foreignInv.destroy();
        await otherSeq.destroy();
        await otherCompany.destroy();

        // ============================================================
        // TEST 8: admin intenta borrar → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 8: admin intenta borrar ---');
        const inv3 = await createTestInvoice(companyAdminCookie);
        const adminRes = await request(`/api/invoices/me/${inv3.id}`, {
            method: 'DELETE',
            headers: { Cookie: adminCookie }
        });
        test('status 400', adminRes.status === 400);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 9: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 9: sin autenticación ---');
        const noAuthRes = await request(`/api/invoices/me/${inv3.id}`, {
            method: 'DELETE'
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 10: audit log
        // ============================================================
        console.log('\n--- Test 10: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'invoice.deleted',
                entity: 'invoice'
            }
        });
        test('has invoice.deleted logs', auditCount >= 1, `count: ${auditCount}`);

        // ============================================================
        // TEST 11: invoicesUsedThisMonth NO se decrementa
        // ============================================================
        console.log('\n--- Test 11: invoicesUsedThisMonth intacto ---');
        const subscription = await Subscription.findOne({ where: { companyId: testCompanyId } });
        // Se crearon 3 facturas (inv1 borrada, inv2, inv3) → contador debe ser 3
        test('invoicesUsedThisMonth is 3', Number(subscription.invoicesUsedThisMonth) === 3, `got ${subscription.invoicesUsedThisMonth}`);

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
            await User.destroy({ where: { email: [testEmail, adminEmail] } });
            // Cleanup huérfano
            const orphanCompany = await Company.findOne({ where: { rnc: '130999998' } });
            if (orphanCompany) {
                await Sequence.destroy({ where: { companyId: orphanCompany.id } });
                await Invoice.destroy({ where: { companyId: orphanCompany.id } });
                await Company.destroy({ where: { id: orphanCompany.id } });
            }
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();