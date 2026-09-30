require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, Sequence,
    Invoice, InvoiceLine, AuditLog
} = require('../../src/models');

let companyAdminCookie = null;
const testRnc = '130999975';
const testEmail = 'owner-inv-upd-ret@expedinap.com';
let testCompanyId = null;
let seq41Id = null;
let seq43Id = null;
let seq47Id = null;
let inv41Id = null;
let inv43Id = null;
let inv47Id = null;

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
        await User.destroy({ where: { email: testEmail } });

        // Setup: empresa
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Update Retencion Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'UpdRet' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;
        test('company registered', !!testCompanyId);

        // Setup: secuencias 41, 43, 47
        const s41 = await Sequence.create({
            companyId: testCompanyId, type: '41', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq41Id = s41.id;

        const s43 = await Sequence.create({
            companyId: testCompanyId, type: '43', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq43Id = s43.id;

        const s47 = await Sequence.create({
            companyId: testCompanyId, type: '47', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        seq47Id = s47.id;

        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        test('logged in', !!companyAdminCookie);

        // ============================================================
        // SETUP: crear las 3 facturas de trabajo
        // ============================================================
        console.log('--- Setup: crear facturas ---');

        // 41 en draft, con retención
        const create41Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '41',
                receiverRnc: '130999888',
                receiverName: 'Proveedor SRL',
                totalItbisRetenido: 180.00,
                items: [{
                    description: 'Compra inicial',
                    quantity: 1,
                    unitPrice: 1000,
                    itbisRate: 18,
                    retencion: { indicador: 1, montoItbisRetenido: 180.00, montoIsrRetenido: 0 }
                }]
            })
        });
        test('41 created', create41Res.status === 201, `got ${create41Res.status}`);
        inv41Id = create41Res.body?.data?.invoice?.id;

        // 43 en draft
        const create43Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '43',
                exemptAmount: 500.00,
                items: [{ description: 'Gasto', quantity: 1, unitPrice: 500, itbisRate: 0 }]
            })
        });
        test('43 created', create43Res.status === 201, `got ${create43Res.status}`);
        inv43Id = create43Res.body?.data?.invoice?.id;

        // 47 en draft, con retención
        const create47Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '47',
                receiverIdentificadorExtranjero: 'US-98765432',
                receiverName: 'Foreign Provider',
                totalIsrRetencion: 270.00,
                transporte: { paisDestino: 'Estados Unidos' },
                items: [{
                    description: 'Servicio exterior',
                    quantity: 1,
                    unitPrice: 1000,
                    itbisRate: 0,
                    retencion: { indicador: 1, montoIsrRetenido: 270.00 }
                }]
            })
        });
        test('47 created', create47Res.status === 201, `got ${create47Res.status}`);
        inv47Id = create47Res.body?.data?.invoice?.id;

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: editar items de un 41 con retención válida → 200
        // ============================================================
        console.log('--- Test 1: editar items de un 41 con retención válida ---');
        const upd1Res = await request(`/api/invoices/me/${inv41Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{
                    description: 'Compra editada',
                    quantity: 2,
                    unitPrice: 500,
                    itbisRate: 18,
                    retencion: { indicador: 1, montoItbisRetenido: 180.00, montoIsrRetenido: 0 }
                }]
            })
        });
        test('status 200', upd1Res.status === 200, `got ${upd1Res.status} ${JSON.stringify(upd1Res.body?.error || {})}`);

        // Verificación en DB
        const lines41After = await InvoiceLine.findAll({
            where: { invoiceId: inv41Id },
            order: [['lineNumber', 'ASC']]
        });
        test('41 has 1 line after update', lines41After.length === 1);
        test('41 line description updated', lines41After[0]?.description === 'Compra editada');
        test('41 line quantity updated', Number(lines41After[0]?.quantity) === 2);
        test('41 line retencionIndicador preserved', Number(lines41After[0]?.retencionIndicador) === 1);
        test('41 line montoItbisRetenido preserved', Number(lines41After[0]?.montoItbisRetenido) === 180);

        // ============================================================
        // TEST 2: editar items de un 41 SIN retención → 409 RETENCION_REQUIRED
        // ============================================================
        console.log('\n--- Test 2: editar items de un 41 sin retención → 409 ---');
        const upd2Res = await request(`/api/invoices/me/${inv41Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{
                    description: 'Sin retención',
                    quantity: 1,
                    unitPrice: 500,
                    itbisRate: 18
                }]
            })
        });
        test('status 409', upd2Res.status === 409, `got ${upd2Res.status}`);
        test('code RETENCION_REQUIRED', upd2Res.body?.error?.code === 'RETENCION_REQUIRED');

        // La factura original debe seguir intacta
        const lines41Check = await InvoiceLine.findAll({ where: { invoiceId: inv41Id } });
        test('41 lines intact after failed update', lines41Check.length === 1);
        test('41 line still has retencion', Number(lines41Check[0]?.retencionIndicador) === 1);

        // ============================================================
        // TEST 3: intentar meter retención en un 43 → 409 RETENCION_NOT_ALLOWED
        // ============================================================
        console.log('\n--- Test 3: intentar meter retención en un 43 → 409 ---');
        const upd3Res = await request(`/api/invoices/me/${inv43Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{
                    description: 'Gasto con retención inválida',
                    quantity: 1,
                    unitPrice: 500,
                    itbisRate: 0,
                    retencion: { indicador: 1, montoItbisRetenido: 90 }
                }]
            })
        });
        test('status 409', upd3Res.status === 409, `got ${upd3Res.status}`);
        test('code RETENCION_NOT_ALLOWED', upd3Res.body?.error?.code === 'RETENCION_NOT_ALLOWED');

        // ============================================================
        // TEST 4: editar items de un 47 con retención válida → 200
        // ============================================================
        console.log('\n--- Test 4: editar items de un 47 con retención válida ---');
        const upd4Res = await request(`/api/invoices/me/${inv47Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{
                    description: 'Servicio exterior editado',
                    quantity: 1,
                    unitPrice: 1500,
                    itbisRate: 0,
                    retencion: { indicador: 1, montoIsrRetenido: 405.00 }
                }]
            })
        });
        test('status 200', upd4Res.status === 200, `got ${upd4Res.status} ${JSON.stringify(upd4Res.body?.error || {})}`);

        const lines47After = await InvoiceLine.findAll({ where: { invoiceId: inv47Id } });
        test('47 line description updated', lines47After[0]?.description === 'Servicio exterior editado');
        test('47 line montoIsrRetenido updated', Number(lines47After[0]?.montoIsrRetenido) === 405);

        // ============================================================
        // TEST 5: intentar editar retención de un 41 ya emitido → 409
        // ============================================================
        console.log('\n--- Test 5: editar 41 ya emitido → 409 ---');
        await Invoice.update(
            { status: 'sent', trackId: 'TRACK-41-SENT' },
            { where: { id: inv41Id } }
        );

        const upd5Res = await request(`/api/invoices/me/${inv41Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                items: [{
                    description: 'Intento sobre emitida',
                    quantity: 1,
                    unitPrice: 500,
                    itbisRate: 18,
                    retencion: { indicador: 1, montoItbisRetenido: 90 }
                }]
            })
        });
        test('status 409', upd5Res.status === 409);
        test('code INVOICE_NOT_EDITABLE', upd5Res.body?.error?.code === 'INVOICE_NOT_EDITABLE');

        // ============================================================
        // TEST 6: editar otros campos (sin tocar items) de un 41 → 200
        // (retención no debe perderse si no se envían items)
        // ============================================================
        console.log('\n--- Test 6: editar receiverName sin tocar items → 200 ---');
        // Volver a draft
        await Invoice.update(
            { status: 'draft', trackId: null },
            { where: { id: inv41Id } }
        );

        const upd6Res = await request(`/api/invoices/me/${inv41Id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ receiverName: 'Proveedor Renombrado' })
        });
        test('status 200', upd6Res.status === 200);
        test('receiverName updated', upd6Res.body?.data?.invoice?.receiverName === 'Proveedor Renombrado');

        // Las líneas de retención NO debieron cambiar (no se enviaron items)
        const lines41Final = await InvoiceLine.findAll({ where: { invoiceId: inv41Id } });
        test('41 line still has retencion after name-only update',
            Number(lines41Final[0]?.retencionIndicador) === 1);
        test('41 line montoItbisRetenido still 180',
            Number(lines41Final[0]?.montoItbisRetenido) === 180);

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