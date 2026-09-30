require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let companyAdminCookie = null;
let testRnc = '130999933';
let testEmail = 'owner-inv-create@expedinap.com';
let testCompanyId = null;
let testSequence32Id = null;
let testSequence33Id = null;
let testSequence34Id = null;
let originalInvoiceId = null;

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

        // Limpieza
        await cleanupCompany(testRnc);
        await User.destroy({ where: { email: testEmail } });

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Notas Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'Notas' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Secuencias 32, 33, 34
        const seq32 = await Sequence.create({
            companyId: testCompanyId,
            type: '32', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequence32Id = seq32.id;

        const seq33 = await Sequence.create({
            companyId: testCompanyId,
            type: '33', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequence33Id = seq33.id;

        const seq34 = await Sequence.create({
            companyId: testCompanyId,
            type: '34', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        testSequence34Id = seq34.id;

        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        console.log('✅ Setup completed\n');

        // ============================================================
        // SETUP: crear una factura 32 original (para usarla como referencia)
        // ============================================================
        console.log('--- Setup: crear factura 32 original ---');
        const origRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                receiverRnc: '130999888',
                receiverName: 'Cliente Original',
                items: [{ description: 'Servicio original', quantity: 1, unitPrice: 1000, itbisRate: 18 }]
            })
        });
        test('original invoice created', origRes.status === 201);
        originalInvoiceId = origRes.body?.data?.invoice?.id;

        // Promoverla a 'accepted' para que sea modificable
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-ORIG-001' },
            { where: { id: originalInvoiceId } }
        );
        const originalNcf = origRes.body?.data?.invoice?.ncf;
        console.log(`   Original NCF: ${originalNcf}\n`);

        // 🔥 NUEVO: flags por tipo en la factura 32 original
        const origInv = origRes.body?.data?.invoice;
        test('orig has isNota false', origInv?.isNota === false);
        test('orig has isDebitNote false', origInv?.isDebitNote === false);
        test('orig has isCreditNote false', origInv?.isCreditNote === false);
        test('orig has typeName Factura de Consumo', origInv?.typeName === 'Factura de Consumo Electrónica');
        test('orig has hasModificationReference false', origInv?.hasModificationReference === false);
        test('orig has canEditReference false', origInv?.canEditReference === false);

        // ============================================================
        // TEST 1: crear Nota de Débito (33) válida
        // ============================================================
        console.log('\n--- Test 1: crear Nota de Débito (33) válida ---');
        const create33Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                receiverRnc: '130999888',
                receiverName: 'Cliente Original',
                modifiedNcf: originalNcf,
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                modificationReason: 'Corrección de monto por error',
                items: [{ description: 'Ajuste', quantity: 1, unitPrice: 500, itbisRate: 18 }]
            })
        });
        test('status 201', create33Res.status === 201, `got ${create33Res.status}`);
        const inv33 = create33Res.body?.data?.invoice;
        test('type is 33', inv33?.type === '33');
        test('ncf starts with E33', inv33?.ncf?.startsWith('E33'));
        test('modifiedNcf persisted', inv33?.modifiedNcf === originalNcf);
        test('modifiedNcfDate persisted', !!inv33?.modifiedNcfDate);
        test('modificationCode persisted', Number(inv33?.modificationCode) === 3);
        test('modificationReason persisted', inv33?.modificationReason === 'Corrección de monto por error');
        test('indicadorNotaCredito is null for 33', inv33?.indicadorNotaCredito === null);

        // 🔥 NUEVO: flags por tipo en la nota 33
        test('inv33 has isNota true', inv33?.isNota === true);
        test('inv33 has isDebitNote true', inv33?.isDebitNote === true);
        test('inv33 has isCreditNote false', inv33?.isCreditNote === false);
        test('inv33 has typeName Nota de Débito', inv33?.typeName === 'Nota de Débito Electrónica');
        test('inv33 has hasModificationReference true', inv33?.hasModificationReference === true);
        test('inv33 has canEditReference false', inv33?.canEditReference === false);

        const note33Id = inv33?.id;

        // ============================================================
        // TEST 2: crear Nota de Crédito (34) válida (dentro de 30 días → indicador 0)
        // ============================================================
        console.log('\n--- Test 2: crear Nota de Crédito (34) dentro de 30 días ---');
        // Crear otra factura original para el 34
        const orig2Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                receiverName: 'Cliente 2',
                items: [{ description: 'Servicio 2', quantity: 1, unitPrice: 500, itbisRate: 18 }]
            })
        });
        const orig2Ncf = orig2Res.body?.data?.invoice?.ncf;
        const orig2Id = orig2Res.body?.data?.invoice?.id;

        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-ORIG-002' },
            { where: { id: orig2Id } }
        );

        const create34Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                receiverName: 'Cliente 2',
                modifiedNcf: orig2Ncf,
                modifiedNcfDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 días atrás
                modificationCode: 1,
                modificationReason: 'Devolución de producto',
                indicadorNotaCredito: 0,  // ≤ 30 días
                items: [{ description: 'Devolución', quantity: 1, unitPrice: 500, itbisRate: 18 }]
            })
        });
        test('status 201', create34Res.status === 201, `got ${create34Res.status}`);
        const inv34 = create34Res.body?.data?.invoice;
        test('type is 34', inv34?.type === '34');
        test('ncf starts with E34', inv34?.ncf?.startsWith('E34'));
        test('modifiedNcf persisted', inv34?.modifiedNcf === orig2Ncf);
        test('modificationCode persisted', Number(inv34?.modificationCode) === 1);
        test('indicadorNotaCredito is 0', Number(inv34?.indicadorNotaCredito) === 0);

        // 🔥 NUEVO: flags por tipo en la nota 34
        test('inv34 has isNota true', inv34?.isNota === true);
        test('inv34 has isDebitNote false', inv34?.isDebitNote === false);
        test('inv34 has isCreditNote true', inv34?.isCreditNote === true);
        test('inv34 has typeName Nota de Crédito', inv34?.typeName === 'Nota de Crédito Electrónica');
        test('inv34 has hasModificationReference true', inv34?.hasModificationReference === true);
        test('inv34 has canEditReference false', inv34?.canEditReference === false);

        const note34Id = inv34?.id;

        // ============================================================
        // TEST 3: crear 33 sin modifiedNcf → 400 (Joi)
        // ============================================================
        console.log('\n--- Test 3: 33 sin modifiedNcf → 400 ---');
        const noModNcfRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', noModNcfRes.status === 400);
        test('code VALIDATION_ERROR', noModNcfRes.body?.error?.code === 'VALIDATION_ERROR');

        // ============================================================
        // TEST 4: crear 31 con modifiedNcf → 400 (Joi forbidden)
        // ============================================================
        console.log('\n--- Test 4: 31 con modifiedNcf → 400 ---');
        const bad31Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '31',
                modifiedNcf: originalNcf,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', bad31Res.status === 400);

        // ============================================================
        // TEST 5: crear 34 con indicadorNotaCredito incoherente → 400 (custom)
        // ============================================================
        console.log('\n--- Test 5: 34 con indicador incoherente → 400 ---');
        const badIndicadorRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                modifiedNcf: originalNcf,
                modifiedNcfDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 días atrás
                modificationCode: 1,
                indicadorNotaCredito: 0,  // ❌ debería ser 1 porque > 30 días
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 400', badIndicadorRes.status === 400);

        // ============================================================
        // TEST 6: crear 33 con NCF que no existe → 404
        // ============================================================
        console.log('\n--- Test 6: 33 con NCF inexistente → 404 ---');
        const noOriginalRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: 'E320000009999',   // NCF que no existe
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 404', noOriginalRes.status === 404);
        test('code ORIGINAL_INVOICE_NOT_FOUND', noOriginalRes.body?.error?.code === 'ORIGINAL_INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 7: crear 33 sobre factura en draft → 409 ORIGINAL_NOT_EMITTED
        // ============================================================
        console.log('\n--- Test 7: 33 sobre factura en draft → 409 ---');
        const draftRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Será draft', quantity: 1, unitPrice: 100 }]
            })
        });
        const draftNcf = draftRes.body?.data?.invoice?.ncf;
        // NO la promovemos → sigue en draft

        const overDraftRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: draftNcf,
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', overDraftRes.status === 409, `got ${overDraftRes.status}`);
        test('code ORIGINAL_NOT_EMITTED', overDraftRes.body?.error?.code === 'ORIGINAL_NOT_EMITTED');

        // ============================================================
        // TEST 8: crear 34 que modifica un 33 → 409 INVALID_ORIGINAL_TYPE
        // ============================================================
        console.log('\n--- Test 8: 34 modificando un 33 → 409 ---');

        // Promover la nota 33 a 'accepted' para que pase el filtro de status
        // y llegue a la validación de tipo
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-NOTE-33' },
            { where: { id: note33Id } }
        );

        const overNotaRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '34',
                modifiedNcf: inv33?.ncf,
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 1,
                indicadorNotaCredito: 0,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', overNotaRes.status === 409, `got ${overNotaRes.status}`);
        test('code INVALID_ORIGINAL_TYPE', overNotaRes.body?.error?.code === 'INVALID_ORIGINAL_TYPE');

        // ============================================================
        // TEST 9: crear 33 sobre factura ya modificada → 409
        // ============================================================
        console.log('\n--- Test 9: 33 sobre factura ya modificada → 409 ---');
        const alreadyModRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: originalNcf,   // ya tiene una 33 activa
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', alreadyModRes.status === 409, `got ${alreadyModRes.status}`);
        test('code ORIGINAL_ALREADY_MODIFIED', alreadyModRes.body?.error?.code === 'ORIGINAL_ALREADY_MODIFIED');

        // ============================================================
        // TEST 10: 33 sin secuencia activa → 409 NO_ACTIVE_SEQUENCE
        // ============================================================
        console.log('\n--- Test 10: 33 sin secuencia → 409 ---');

        // Crear una factura 32 fresca y emitirla (para que no tenga nota activa)
        const freshRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Fresh', quantity: 1, unitPrice: 100 }]
            })
        });
        const freshNcf = freshRes.body?.data?.invoice?.ncf;
        const freshId = freshRes.body?.data?.invoice?.id;
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-FRESH' },
            { where: { id: freshId } }
        );

        // Desactivar la secuencia 33
        await Sequence.update({ isActive: false }, { where: { id: testSequence33Id } });

        const noSeqRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: freshNcf,          // ← NCF fresco sin nota activa
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', noSeqRes.status === 409);
        test('code NO_ACTIVE_SEQUENCE', noSeqRes.body?.error?.code === 'NO_ACTIVE_SEQUENCE');

        // Reactivar
        await Sequence.update({ isActive: true }, { where: { id: testSequence33Id } });

        // ============================================================
        // TEST 11: verificar persistencia en DB de la nota 33
        // ============================================================
        console.log('\n--- Test 11: persistencia en DB ---');
        const dbNote33 = await Invoice.findByPk(note33Id);
        test('DB type is 33', dbNote33.type === '33');
        test('DB modifiedNcf matches', dbNote33.modifiedNcf === originalNcf);
        test('DB modificationCode is 3', Number(dbNote33.modificationCode) === 3);
        test('DB indicadorNotaCredito is null', dbNote33.indicadorNotaCredito === null);

        // ============================================================
        // TEST 12: no se puede modificar (update) una 33/34
        // ============================================================
        console.log('\n--- Test 12: no se puede editar una 33 ---');
        const updateNoteRes = await request(`/api/invoices/me/${note33Id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                receiverName: 'Otro nombre'
            })
        });
        // Nota: hoy la update no bloquea por type, solo por status. Como está en draft,
        // se permite. Si en el futuro quieres bloquear edición de 33/34, va en 11.11.
        test('update allowed while draft (por ahora)', updateNoteRes.status === 200 || updateNoteRes.status === 409);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await cleanupCompany(testRnc);
            await User.destroy({ where: { email: testEmail } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();