require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

// ============================================================
// Estado del test
// ============================================================
let companyAdminCookie = null;
let testRnc = '130999935';
let testEmail = 'owner-inv-upd-me@expedinap.com';
let testCompanyId = null;
let seq32Id = null;
let seq33Id = null;
let seq34Id = null;
let originalNcf = null;
let originalId = null;
let note33Id = null;
let note34Id = null;
let draft32Id = null;

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

        // ============================================================
        // CLEANUP + SETUP
        // ============================================================
        await cleanupCompany(testRnc);
        await User.destroy({ where: { email: testEmail } });

        // Crear empresa + dueño
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Invoices Update Notas Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'UpdNotas' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Secuencias 32, 33, 34
        const seq32 = await Sequence.create({
            companyId: testCompanyId, type: '32', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq32Id = seq32.id;

        const seq33 = await Sequence.create({
            companyId: testCompanyId, type: '33', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq33Id = seq33.id;

        const seq34 = await Sequence.create({
            companyId: testCompanyId, type: '34', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq34Id = seq34.id;

        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        console.log('✅ Setup completed\n');

        // ------------------------------------------------------------
        // SETUP: factura 32 original y emitirla
        // ------------------------------------------------------------
        const origRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '32',
                receiverName: 'Cliente Original',
                items: [{ description: 'Servicio', quantity: 1, unitPrice: 1000, itbisRate: 18 }]
            })
        });
        originalNcf = origRes.body?.data?.invoice?.ncf;
        originalId = origRes.body?.data?.invoice?.id;
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-ORIG' },
            { where: { id: originalId } }
        );

        // ------------------------------------------------------------
        // SETUP: nota 33 (draft)
        // ------------------------------------------------------------
        const create33Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '33',
                receiverName: 'Cliente Original',
                modifiedNcf: originalNcf,
                modifiedNcfDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                modificationCode: 3,
                modificationReason: 'Ajuste inicial',
                items: [{ description: 'Ajuste', quantity: 1, unitPrice: 500, itbisRate: 18 }]
            })
        });
        note33Id = create33Res.body?.data?.invoice?.id;
        console.log(`   Nota 33 creada: ${create33Res.body?.data?.invoice?.ncf}`);

        // ------------------------------------------------------------
        // SETUP: factura 32 fresca para la nota 34
        // ------------------------------------------------------------
        const orig2Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '32',
                receiverName: 'Cliente 2',
                items: [{ description: 'Servicio 2', quantity: 1, unitPrice: 800, itbisRate: 18 }]
            })
        });
        const original2Ncf = orig2Res.body?.data?.invoice?.ncf;
        const original2Id = orig2Res.body?.data?.invoice?.id;
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-ORIG-2' },
            { where: { id: original2Id } }
        );

        // ------------------------------------------------------------
        // SETUP: nota 34 (draft) — 5 días después del original
        // ------------------------------------------------------------
        const create34Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '34',
                receiverName: 'Cliente 2',
                modifiedNcf: original2Ncf,
                modifiedNcfDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                modificationCode: 1,
                modificationReason: 'Devolución',
                indicadorNotaCredito: 0,
                items: [{ description: 'Devolución', quantity: 1, unitPrice: 800, itbisRate: 18 }]
            })
        });
        note34Id = create34Res.body?.data?.invoice?.id;
        console.log(`   Nota 34 creada: ${create34Res.body?.data?.invoice?.ncf}\n`);

        // ============================================================
        // BLOQUE 1: Editar campos permitidos en draft
        // ============================================================

        console.log('--- Test 1: editar líneas de una 34 en draft ---');
        const upd1Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{ description: 'Nueva devolución', quantity: 2, unitPrice: 500, itbisRate: 18 }]
            })
        });
        test('status 200', upd1Res.status === 200, `got ${upd1Res.status}`);
        const upd1 = upd1Res.body?.data?.invoice;
        test('subtotal is 1000', Number(upd1?.subtotal) === 1000, `got ${upd1?.subtotal}`);
        test('itbis is 180', Number(upd1?.itbis) === 180);
        test('total is 1180', Number(upd1?.total) === 1180);
        test('modifiedNcf unchanged', upd1?.modifiedNcf === original2Ncf);

        console.log('\n--- Test 2: editar modificationCode y modificationReason de una 34 ---');
        const upd2Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                modificationCode: 3,
                modificationReason: 'Corrección de monto'
            })
        });
        test('status 200', upd2Res.status === 200);
        const upd2 = upd2Res.body?.data?.invoice;
        test('modificationCode updated to 3', Number(upd2?.modificationCode) === 3);
        test('modificationReason updated', upd2?.modificationReason === 'Corrección de monto');

        console.log('\n--- Test 3: editar modificationCode de una 33 ---');
        const upd3Res = await request(`/api/invoices/me/${note33Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                modificationCode: 1,
                modificationReason: 'Anulación'
            })
        });
        test('status 200', upd3Res.status === 200);
        const upd3 = upd3Res.body?.data?.invoice;
        test('modificationCode is 1', Number(upd3?.modificationCode) === 1);
        test('modificationReason is Anulación', upd3?.modificationReason === 'Anulación');
        test('indicadorNotaCredito is null for 33', upd3?.indicadorNotaCredito === null);

        console.log('\n--- Test 4: editar receiverName de una 34 ---');
        const upd4Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                receiverName: 'Cliente Renombrado'
            })
        });
        test('status 200', upd4Res.status === 200);
        test('receiverName updated', upd4Res.body?.data?.invoice?.receiverName === 'Cliente Renombrado');

        // ============================================================
        // BLOQUE 2: Campos de referencia bloqueados por Joi
        // ============================================================

        console.log('\n--- Test 5: cambiar modifiedNcf → 400 ---');
        const upd5Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modifiedNcf: 'E320000009999' })
        });
        test('status 400', upd5Res.status === 400);
        test('code VALIDATION_ERROR', upd5Res.body?.error?.code === 'VALIDATION_ERROR');

        console.log('\n--- Test 6: cambiar modifiedNcfDate → 400 ---');
        const upd6Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modifiedNcfDate: new Date().toISOString() })
        });
        test('status 400', upd6Res.status === 400);

        console.log('\n--- Test 7: cambiar modifiedNcfIssuerRnc → 400 ---');
        const upd7Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modifiedNcfIssuerRnc: '130999999' })
        });
        test('status 400', upd7Res.status === 400);

        console.log('\n--- Test 8: cambiar indicadorNotaCredito → 400 ---');
        const upd8Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ indicadorNotaCredito: 1 })
        });
        test('status 400', upd8Res.status === 400);

        // ============================================================
        // BLOQUE 3: Recalculo automático de indicadorNotaCredito en 34
        // ============================================================

        console.log('\n--- Test 9: cambiar issuedAt en 34 dentro de 30 días → indicador se mantiene 0 ---');
        const upd9Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                issuedAt: new Date(Date.now() - 1000).toISOString()
            })
        });
        test('status 200', upd9Res.status === 200);
        test('indicadorNotaCredito still 0',
            Number(upd9Res.body?.data?.invoice?.indicadorNotaCredito) === 0,
            `got ${upd9Res.body?.data?.invoice?.indicadorNotaCredito}`);

        console.log('\n--- Test 10: cambiar issuedAt en 34 después de 30 días → indicador pasa a 1 ---');
        // modifiedNcfDate está a 5 días atrás. Para que el diff sea > 30 días,
        // necesitamos un issuedAt a más de 30 días en el futuro respecto al modifiedNcfDate.
        // Como no podemos emitir con fecha futura, este test lo hacemos simulando
        // que la modifiedNcfDate es de hace 40 días → mutamos directo en DB.
        const original2 = await Invoice.findByPk(note34Id);
        await Invoice.update(
            { modifiedNcfDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
            { where: { id: note34Id }, silent: true }
        );

        const upd10Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                issuedAt: new Date().toISOString()
            })
        });
        test('status 200', upd10Res.status === 200, `got ${upd10Res.status}`);
        test('indicadorNotaCredito recalculated to 1',
            Number(upd10Res.body?.data?.invoice?.indicadorNotaCredito) === 1,
            `got ${upd10Res.body?.data?.invoice?.indicadorNotaCredito}`);

        // Restaurar para no afectar tests siguientes
        await Invoice.update(
            { modifiedNcfDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
            { where: { id: note34Id }, silent: true }
        );

        // ============================================================
        // BLOQUE 4: Modificación en 31/32 no permitida
        // ============================================================

        console.log('\n--- Test 11: modificationCode en un 32 → 409 ---');
        const create32Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        draft32Id = create32Res.body?.data?.invoice?.id;

        const upd11Res = await request(`/api/invoices/me/${draft32Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modificationCode: 3 })
        });
        test('status 409', upd11Res.status === 409, `got ${upd11Res.status}`);
        test('code MODIFICATION_FIELDS_NOT_ALLOWED',
            upd11Res.body?.error?.code === 'MODIFICATION_FIELDS_NOT_ALLOWED');

        console.log('\n--- Test 12: modificationReason en un 32 → 409 ---');
        const upd12Res = await request(`/api/invoices/me/${draft32Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modificationReason: 'Intento' })
        });
        test('status 409', upd12Res.status === 409);
        test('code MODIFICATION_FIELDS_NOT_ALLOWED',
            upd12Res.body?.error?.code === 'MODIFICATION_FIELDS_NOT_ALLOWED');

        // ============================================================
        // BLOQUE 5: Bloqueo por status !== draft
        // ============================================================

        console.log('\n--- Test 13: editar nota 34 ya emitida → 409 ---');
        await Invoice.update(
            { status: 'sent', trackId: 'TRACK-SENT-34' },
            { where: { id: note34Id } }
        );

        const upd13Res = await request(`/api/invoices/me/${note34Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ receiverName: 'Intento' })
        });
        test('status 409', upd13Res.status === 409);
        test('code INVOICE_NOT_EDITABLE', upd13Res.body?.error?.code === 'INVOICE_NOT_EDITABLE');

        console.log('\n--- Test 14: editar nota 33 ya emitida → 409 ---');
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-ACCEPTED-33' },
            { where: { id: note33Id } }
        );

        const upd14Res = await request(`/api/invoices/me/${note33Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modificationReason: 'Intento' })
        });
        test('status 409', upd14Res.status === 409);
        test('code INVOICE_NOT_EDITABLE', upd14Res.body?.error?.code === 'INVOICE_NOT_EDITABLE');

        // ============================================================
        // BLOQUE 6: Validaciones básicas
        // ============================================================

        console.log('\n--- Test 15: body vacío → 400 ---');
        const upd15Res = await request(`/api/invoices/me/${draft32Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({})
        });
        test('status 400', upd15Res.status === 400);

        console.log('\n--- Test 16: modificationCode fuera de rango (6) → 400 ---');
        const upd16Res = await request(`/api/invoices/me/${draft32Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ modificationCode: 6 })
        });
        test('status 400', upd16Res.status === 400);

        // ============================================================
        // BLOQUE 7: Auditoría y consistencia
        // ============================================================

        console.log('\n--- Test 17: audit log de updates ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'invoice.updated',
                entity: 'invoice'
            }
        });
        test('has invoice.updated logs', auditCount >= 3, `count: ${auditCount}`);

        console.log('\n--- Test 18: persistencia en DB de la nota 33 ---');
        const dbNote33 = await Invoice.findByPk(note33Id);
        test('DB type is 33', dbNote33.type === '33');
        test('DB modificationCode is 1', Number(dbNote33.modificationCode) === 1);
        test('DB modificationReason is Anulación', dbNote33.modificationReason === 'Anulación');
        test('DB indicadorNotaCredito is null', dbNote33.indicadorNotaCredito === null);

        console.log('\n--- Test 19: currentNumber NO cambió al editar ---');
        const seqAfter = await Sequence.findByPk(seq32Id);
        // Se crearon: 1 original + 1 para nota 34 + 1 draft32 = 3 facturas tipo 32
        test('seq32 currentNumber is 3', Number(seqAfter.currentNumber) === 3, `got ${seqAfter.currentNumber}`);

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