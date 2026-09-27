require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999931';
let testEmail = 'owner-inv-update@expedinap.com';
let adminEmail = 'admin-inv-update@expedinap.com';
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

async function createTestInvoice(cookie, overrides = {}) {
    const res = await request('/api/invoices/me', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            type: '32',
            receiverName: 'Cliente Inicial',
            items: [
                { description: 'Item Original', quantity: 1, unitPrice: 100, discount: 0, itbisRate: 18 }
            ],
            ...overrides
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
            lastName: 'InvUpdate',
            role: 'admin'
        });
        adminId = adminUser.id;

        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Update Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvUpdate' }
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
        // TEST 1: editar receiverName y receiverRnc
        // ============================================================
        console.log('--- Test 1: editar datos del comprador ---');
        const inv1 = await createTestInvoice(companyAdminCookie);
        const updateRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                receiverRnc: '130999888',
                receiverName: 'Nuevo Cliente SRL'
            })
        });
        test('status 200', updateRes.status === 200, `got ${updateRes.status}`);
        test('receiverRnc updated', updateRes.body?.data?.invoice?.receiverRnc === '130999888');
        test('receiverName updated', updateRes.body?.data?.invoice?.receiverName === 'Nuevo Cliente SRL');

        // ============================================================
        // TEST 2: editar items (reemplaza todas las líneas)
        // ============================================================
        console.log('\n--- Test 2: reemplazar items ---');
        const updateItemsRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                items: [
                    { description: 'Nuevo Item 1', quantity: 2, unitPrice: 50, itbisRate: 18 },
                    { description: 'Nuevo Item 2', quantity: 1, unitPrice: 100, itbisRate: 18 },
                    { description: 'Nuevo Item 3', quantity: 1, unitPrice: 200, itbisRate: 0 }
                ]
            })
        });
        test('status 200', updateItemsRes.status === 200);
        test('has 3 lines now', updateItemsRes.body?.data?.invoice?.lines?.length === 3);
        test('lineCount is 3', updateItemsRes.body?.data?.invoice?.lineCount === 3);
        // subtotal = (2*50) + (1*100) + (1*200) = 400
        test('subtotal is 400', Number(updateItemsRes.body?.data?.invoice?.subtotal) === 400);
        // itbis = (100*0.18) + (100*0.18) + (200*0) = 18 + 18 + 0 = 36
        test('itbis is 36', Number(updateItemsRes.body?.data?.invoice?.itbis) === 36);
        // total = 400 + 36 = 436
        test('total is 436', Number(updateItemsRes.body?.data?.invoice?.total) === 436);

        // Verificar orden de líneas
        const lines = updateItemsRes.body?.data?.invoice?.lines || [];
        test('lines ordered correctly', 
            lines[0]?.lineNumber === 1 && lines[1]?.lineNumber === 2 && lines[2]?.lineNumber === 3);

        // ============================================================
        // TEST 3: editar issuedAt válido
        // ============================================================
        console.log('\n--- Test 3: editar issuedAt válido ---');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const issuedRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                issuedAt: yesterday
            })
        });
        test('status 200', issuedRes.status === 200);
        test('issuedAt updated', !!issuedRes.body?.data?.invoice?.issuedAt);

        // ============================================================
        // TEST 4: issuedAt futuro → 400
        // ============================================================
        console.log('\n--- Test 4: issuedAt futuro ---');
        const futureRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                issuedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        test('status 400', futureRes.status === 400);

        // ============================================================
        // TEST 5: no editar factura con status !== draft
        // ============================================================
        console.log('\n--- Test 5: factura enviada no editable ---');
        const inv2 = await createTestInvoice(companyAdminCookie);
        await Invoice.update({ status: 'sent' }, { where: { id: inv2.id } });

        const sentRes = await request(`/api/invoices/me/${inv2.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ receiverName: 'Hack' })
        });
        test('status 409', sentRes.status === 409, `got ${sentRes.status}`);
        test('code INVOICE_NOT_EDITABLE', sentRes.body?.error?.code === 'INVOICE_NOT_EDITABLE');

        // ============================================================
        // TEST 6: body vacío → 400
        // ============================================================
        console.log('\n--- Test 6: body vacío ---');
        const emptyRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({})
        });
        test('status 400', emptyRes.status === 400);

        // ============================================================
        // TEST 7: items vacío → 400
        // ============================================================
        console.log('\n--- Test 7: items vacío ---');
        const emptyItemsRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ items: [] })
        });
        test('status 400', emptyItemsRes.status === 400);

        // ============================================================
        // TEST 8: descuento excesivo en línea → 400
        // ============================================================
        console.log('\n--- Test 8: descuento excesivo ---');
        const badDiscountRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: 200 }]
            })
        });
        test('status 400', badDiscountRes.status === 400);

        // ============================================================
        // TEST 9: aislamiento multi-tenant → 404
        // ============================================================
        console.log('\n--- Test 9: otra empresa ---');
        const otherCompany = await Company.create({ rnc: '130999999', name: 'Other' });
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
        const foreignInv = await Invoice.create({
            companyId: otherCompany.id,
            sequenceId: foreignSeq.id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: '130999999',
            issuerName: 'Other',
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: new Date()
        });

        const foreignRes = await request(`/api/invoices/me/${foreignInv.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ receiverName: 'Hack' })
        });
        test('status 404', foreignRes.status === 404);
        test('code INVOICE_NOT_FOUND', foreignRes.body?.error?.code === 'INVOICE_NOT_FOUND');

        await foreignInv.destroy();
        await foreignSeq.destroy();
        await otherCompany.destroy();

        // ============================================================
        // TEST 10: admin intenta editar → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 10: admin intenta editar ---');
        const adminRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ receiverName: 'Hack' })
        });
        test('status 400', adminRes.status === 400);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 11: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 11: sin autenticación ---');
        const noAuthRes = await request(`/api/invoices/me/${inv1.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiverName: 'Hack' })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 12: audit log
        // ============================================================
        console.log('\n--- Test 12: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'invoice.updated',
                entity: 'invoice'
            }
        });
        test('has invoice.updated logs', auditCount >= 3, `count: ${auditCount}`);

        // ============================================================
        // TEST 13: currentNumber NO cambió al editar
        // ============================================================
        console.log('\n--- Test 13: currentNumber intacto ---');
        const seqAfter = await Sequence.findByPk(testSequenceId);
        // Se crearon 2 facturas (inv1 + inv2), currentNumber debe ser 2
        test('currentNumber is 2 (only 2 creates)', Number(seqAfter.currentNumber) === 2, `got ${seqAfter.currentNumber}`);

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
            const orphanCompany = await Company.findOne({ where: { rnc: '130999999' } });
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