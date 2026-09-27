require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let adminCookie = null;
let testRnc = '130999930';
let testEmail = 'owner-inv-create@expedinap.com';
let adminEmail = 'admin-inv-create@expedinap.com';
let testCompanyId = null;
let testSequenceId = null;
let adminId = null;
let subscriptionId = null;

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
        await User.destroy({ where: { email: [testEmail, adminEmail] } });

        // Crear admin
        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'InvCreate',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Create Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'InvCreate' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;
        subscriptionId = registerRes.body?.data?.subscription?.id;

        // Crear secuencia tipo 32
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

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: crear factura exitosamente
        // ============================================================
        console.log('--- Test 1: crear factura exitosamente ---');
        const createRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                receiverName: 'Cliente Final',
                items: [
                    { description: 'Corte de cabello', quantity: 1, unitPrice: 500, discount: 0, itbisRate: 18 },
                    { description: 'Shampoo', quantity: 1, unitPrice: 200, discount: 0, itbisRate: 18 }
                ]
            })
        });
        test('status 201', createRes.status === 201, `got ${createRes.status}`);
        test('has invoice', !!createRes.body?.data?.invoice);
        const inv = createRes.body?.data?.invoice;
        test('ncf is E320000000001', inv?.ncf === 'E320000000001');
        test('type is 32', inv?.type === '32');
        test('status is draft', inv?.status === 'draft');
        test('has 2 lines', inv?.lines?.length === 2);
        test('lineCount is 2', inv?.lineCount === 2);
        test('subtotal is 700', inv?.subtotal === '700.00' || Number(inv?.subtotal) === 700);
        test('itbis is 126', Number(inv?.itbis) === 126);
        test('total is 826', Number(inv?.total) === 826);
        test('issuerRnc matches', inv?.issuerRnc === testRnc);
        test('issuerName matches', inv?.issuerName === 'Invoices Create Test SRL');
        test('receiverName is Cliente Final', inv?.receiverName === 'Cliente Final');
        test('has sequence include', !!inv?.sequence);
        test('isDraft true', inv?.isDraft === true);
        test('canBeSigned true', inv?.canBeSigned === true);
        test('canBeSent false', inv?.canBeSent === false);
        test('canEdit true', inv?.canEdit === true);

        // ============================================================
        // TEST 2: verificar que currentNumber se incrementó
        // ============================================================
        console.log('\n--- Test 2: currentNumber incrementado ---');
        const seqAfter = await Sequence.findByPk(testSequenceId);
        test('currentNumber is 1', Number(seqAfter.currentNumber) === 1);

        // ============================================================
        // TEST 3: crear segunda factura → NCF incrementado
        // ============================================================
        console.log('\n--- Test 3: segunda factura ---');
        const createRes2 = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [
                    { description: 'Servicio 1', quantity: 2, unitPrice: 100, itbisRate: 18 }
                ]
            })
        });
        test('status 201', createRes2.status === 201);
        test('ncf is E320000000002', createRes2.body?.data?.invoice?.ncf === 'E320000000002');
        test('subtotal is 200', Number(createRes2.body?.data?.invoice?.subtotal) === 200);
        test('itbis is 36', Number(createRes2.body?.data?.invoice?.itbis) === 36);
        test('total is 236', Number(createRes2.body?.data?.invoice?.total) === 236);

        // Verificar currentNumber
        const seqAfter2 = await Sequence.findByPk(testSequenceId);
        test('currentNumber is 2', Number(seqAfter2.currentNumber) === 2);

        // ============================================================
        // TEST 4: cálculo correcto con ITBIS 0% (exento)
        // ============================================================
        console.log('\n--- Test 4: ITBIS 0% (exento) ---');
        const createExempt = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [
                    { description: 'Arroz', quantity: 1, unitPrice: 50, itbisRate: 0 },
                    { description: 'Aceite', quantity: 1, unitPrice: 100, itbisRate: 18 }
                ]
            })
        });
        test('status 201', createExempt.status === 201);
        test('subtotal is 150', Number(createExempt.body?.data?.invoice?.subtotal) === 150);
        test('itbis is 18', Number(createExempt.body?.data?.invoice?.itbis) === 18);
        test('total is 168', Number(createExempt.body?.data?.invoice?.total) === 168);

        // ============================================================
        // TEST 5: descuento por línea
        // ============================================================
        console.log('\n--- Test 5: descuento por línea ---');
        const createDiscount = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [
                    { description: 'Producto con descuento', quantity: 1, unitPrice: 1000, discount: 100, itbisRate: 18 }
                ]
            })
        });
        test('status 201', createDiscount.status === 201);
        test('subtotal is 900 (1000 - 100)', Number(createDiscount.body?.data?.invoice?.subtotal) === 900);
        test('itbis is 162', Number(createDiscount.body?.data?.invoice?.itbis) === 162);
        test('total is 1062', Number(createDiscount.body?.data?.invoice?.total) === 1062);

        // ============================================================
        // TEST 6: issuedAt en el futuro → 400
        // ============================================================
        console.log('\n--- Test 6: issuedAt futuro → 400 ---');
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const futureRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                issuedAt: futureDate,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', futureRes.status === 400);
        test('code VALIDATION_ERROR', futureRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 7: issuedAt > 30 días atrás → 400
        // ============================================================
        console.log('\n--- Test 7: issuedAt > 30 días atrás ---');
        const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
        const oldRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                issuedAt: oldDate,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', oldRes.status === 400);
        test('code VALIDATION_ERROR', oldRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 8: más de 100 ítems → 400
        // ============================================================
        console.log('\n--- Test 8: más de 100 ítems ---');
        const tooManyItems = Array.from({ length: 101 }, (_, i) => ({
            description: `Item ${i + 1}`,
            quantity: 1,
            unitPrice: 10
        }));
        const tooManyRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: tooManyItems
            })
        });
        test('status 400', tooManyRes.status === 400);
        test('code VALIDATION_ERROR', tooManyRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 9: descuento > base de línea → 400
        // ============================================================
        console.log('\n--- Test 9: descuento excesivo ---');
        const badDiscountRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: 200 }]
            })
        });
        test('status 400', badDiscountRes.status === 400);

        // ============================================================
        // TEST 10: sin ítems → 400
        // ============================================================
        console.log('\n--- Test 10: sin ítems ---');
        const noItemsRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: []
            })
        });
        test('status 400', noItemsRes.status === 400);

        // ============================================================
        // TEST 11: type inválido → 400
        // ============================================================
        console.log('\n--- Test 11: type inválido ---');
        const badTypeRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '99',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', badTypeRes.status === 400);

        // ============================================================
        // TEST 12: sin secuencia activa para tipo 31 → 409
        // ============================================================
        console.log('\n--- Test 12: sin secuencia activa tipo 31 ---');
        const noSeqRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', noSeqRes.status === 409, `got ${noSeqRes.status}`);
        test('code NO_ACTIVE_SEQUENCE', noSeqRes.body?.error?.code === 'NO_ACTIVE_SEQUENCE');

        // ============================================================
        // TEST 13: secuencia agotada → 409
        // ============================================================
        console.log('\n--- Test 13: secuencia agotada ---');
        // Crear secuencia tipo 33 con 1 solo número
        const tinySeq = await Sequence.create({
            companyId: testCompanyId,
            type: '33',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1,
            currentNumber: 1,  // ← ya agotada
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        const exhaustedRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', exhaustedRes.status === 409, `got ${exhaustedRes.status}`);
        test('code SEQUENCE_EXHAUSTED', exhaustedRes.body?.error?.code === 'SEQUENCE_EXHAUSTED');

        await tinySeq.destroy();

        // ============================================================
        // TEST 14: secuencia vencida (isActive=true pero expirada) → NO_ACTIVE
        // ============================================================
        console.log('\n--- Test 14: secuencia vencida ---');
        const expiredSeq = await Sequence.create({
            companyId: testCompanyId,
            type: '34',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),  // ayer
            isActive: true
        });

        const expiredRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        // La secuencia vencida no se encuentra porque el where filtra expiresAt > now
        test('status 409', expiredRes.status === 409);
        test('code NO_ACTIVE_SEQUENCE', expiredRes.body?.error?.code === 'NO_ACTIVE_SEQUENCE');

        await expiredSeq.destroy();

        // ============================================================
        // TEST 15: admin intenta crear → 400 NO_COMPANY_ASSIGNED
        // ============================================================
        console.log('\n--- Test 15: admin intenta crear ---');
        const adminRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', adminRes.status === 400);
        test('code NO_COMPANY_ASSIGNED', adminRes.body?.error?.code === 'NO_COMPANY_ASSIGNED');

        // ============================================================
        // TEST 16: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 16: sin autenticación ---');
        const noAuthRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 17: audit log
        // ============================================================
        console.log('\n--- Test 17: audit log ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'invoice.created',
                entity: 'invoice'
            }
        });
        test('has invoice.created logs', auditCount >= 4, `count: ${auditCount}`);

        // ============================================================
        // TEST 18: rollback en error (no deja huérfanos)
        // ============================================================
        console.log('\n--- Test 18: rollback en error ---');
        const currentSeq = await Sequence.findByPk(testSequenceId);
        const beforeNumber = Number(currentSeq.currentNumber);

        // Intentar crear factura con tipo inválido ya fue validado por Joi (no llega al servicio)
        // Intentar crear con descuento excesivo también falla en Joi
        // Forzamos un error en el servicio: secuencia tipo 31 sin existir
        await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',  // sin secuencia
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });

        // Verificar que currentNumber NO cambió para tipo 32
        const afterSeq = await Sequence.findByPk(testSequenceId);
        test('currentNumber unchanged after failed create', Number(afterSeq.currentNumber) === beforeNumber);

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
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();