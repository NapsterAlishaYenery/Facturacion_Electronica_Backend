require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    User, Company, Subscription, Sequence,
    Invoice, InvoiceLine, AuditLog
} = require('../../src/models');

let companyAdminCookie = null;
const testRnc = '130999970';
const testEmail = 'owner-inv-alltypes@expedinap.com';
let testCompanyId = null;

const sequenceIds = {};

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

const baseItems = [
    { description: 'Servicio base', quantity: 1, unitPrice: 1000, itbisRate: 18 }
];

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await cleanupCompany(testRnc);
        await User.destroy({ where: { email: testEmail } });

        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'All Types Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'AllTypes' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;
        test('company registered', !!testCompanyId);

        for (const type of ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47']) {
            const seq = await Sequence.create({
                companyId: testCompanyId,
                type,
                prefix: 'E',
                startNumber: 1,
                endNumber: 100,
                currentNumber: 0,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                isActive: true
            });
            sequenceIds[type] = seq.id;
        }
        test('10 sequences created', Object.keys(sequenceIds).length === 10);

        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        test('logged in', !!companyAdminCookie);
        console.log('✅ Setup completed\n');

        // ============================================================
        // TIPO 41 — Compras (retención por línea obligatoria)
        // ============================================================
        console.log('--- e-CF 41: Compras ---');
        const res41 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '41',
                receiverRnc: '130999888',
                receiverName: 'Proveedor SRL',
                totalItbisRetenido: 180.00,
                items: [
                    {
                        description: 'Servicio base',
                        quantity: 1,
                        unitPrice: 1000,
                        itbisRate: 18,
                        retencion: {
                            indicador: 1,
                            montoItbisRetenido: 180.00,
                            montoIsrRetenido: 0
                        }
                    }
                ]
            })
        });
        test('status 201', res41.status === 201, `got ${res41.status} ${JSON.stringify(res41.body?.error || {})}`);
        const inv41 = res41.body?.data?.invoice;
        test('type is 41', inv41?.type === '41');
        test('ncf starts with E41', inv41?.ncf?.startsWith('E41'));
        test('totalItbisRetenido persisted', Number(inv41?.totalItbisRetenido) === 180);
        test('receiverRnc persisted', inv41?.receiverRnc === '130999888');

        // ============================================================
        // TIPO 43 — Gastos Menores
        // ============================================================
        console.log('\n--- e-CF 43: Gastos Menores ---');
        const res43 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '43',
                exemptAmount: 500.00,
                items: [
                    { description: 'Gasto menor', quantity: 1, unitPrice: 500, itbisRate: 0 }
                ]
            })
        });
        test('status 201', res43.status === 201, `got ${res43.status} ${JSON.stringify(res43.body?.error || {})}`);
        const inv43 = res43.body?.data?.invoice;
        test('type is 43', inv43?.type === '43');
        test('ncf starts with E43', inv43?.ncf?.startsWith('E43'));
        test('exemptAmount persisted', Number(inv43?.exemptAmount) === 500);
        test('receiverRnc is null', inv43?.receiverRnc === null);
        test('receiverName is null', inv43?.receiverName === null);

        // ============================================================
        // TIPO 44 — Regímenes Especiales
        // ============================================================
        console.log('\n--- e-CF 44: Regímenes Especiales ---');
        const res44 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '44',
                receiverName: 'Cliente Régimen Especial',
                exemptAmount: 800.00,
                items: [
                    { description: 'Producto régimen especial', quantity: 1, unitPrice: 800, itbisRate: 0 }
                ]
            })
        });
        test('status 201', res44.status === 201, `got ${res44.status} ${JSON.stringify(res44.body?.error || {})}`);
        const inv44 = res44.body?.data?.invoice;
        test('type is 44', inv44?.type === '44');
        test('ncf starts with E44', inv44?.ncf?.startsWith('E44'));
        test('receiverName persisted', inv44?.receiverName === 'Cliente Régimen Especial');
        test('receiverRnc is null', inv44?.receiverRnc === null);
        test('exemptAmount persisted', Number(inv44?.exemptAmount) === 800);

        // ============================================================
        // TIPO 45 — Gubernamental
        // ============================================================
        console.log('\n--- e-CF 45: Gubernamental ---');
        const res45 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '45',
                receiverRnc: '401007548',
                receiverName: 'Ministerio de Educación',
                items: baseItems
            })
        });
        test('status 201', res45.status === 201, `got ${res45.status} ${JSON.stringify(res45.body?.error || {})}`);
        const inv45 = res45.body?.data?.invoice;
        test('type is 45', inv45?.type === '45');
        test('ncf starts with E45', inv45?.ncf?.startsWith('E45'));
        test('receiverRnc persisted', inv45?.receiverRnc === '401007548');
        test('total persisted', Number(inv45?.total) === 1180);

        // ============================================================
        // TIPO 46 — Exportaciones
        // ============================================================
        console.log('\n--- e-CF 46: Exportaciones ---');
        const res46 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '46',
                receiverIdentificadorExtranjero: 'US-12345678',
                receiverName: 'International Buyer LLC',
                receiverPais: 'Estados Unidos',
                itbis3Base: 1000.00,
                itbis3Amount: 0.00,
                transporte: {
                    viaTransporte: '02',
                    paisOrigen: 'República Dominicana',
                    direccionDestino: '123 Main St, Miami, FL',
                    paisDestino: 'Estados Unidos',
                    rncCompaniaTransportista: '101010101',
                    nombreCompaniaTransportista: 'Ocean Freight Co.',
                    numeroViaje: 'VY-2026-001'
                },
                informacionesAdicionales: {
                    nombrePuertoEmbarque: 'Puerto Haina',
                    condicionesEntrega: 'FOB',
                    totalFob: 1000.00,
                    seguro: 50.00,
                    flete: 200.00,
                    totalCif: 1250.00,
                    regimenAduanero: 'EXPORTACION DEFINITIVA',
                    nombrePuertoSalida: 'Haina',
                    nombrePuertoDesembarque: 'Miami'
                },
                items: [
                    { description: 'Producto exportación', quantity: 1, unitPrice: 1000, itbisRate: 0 }
                ]
            })
        });
        test('status 201', res46.status === 201, `got ${res46.status} ${JSON.stringify(res46.body?.error || {})}`);
        const inv46 = res46.body?.data?.invoice;
        test('type is 46', inv46?.type === '46');
        test('ncf starts with E46', inv46?.ncf?.startsWith('E46'));
        test('receiverIdentificadorExtranjero persisted', inv46?.receiverIdentificadorExtranjero === 'US-12345678');
        test('receiverPais persisted', inv46?.receiverPais === 'Estados Unidos');
        test('itbis3Base persisted', Number(inv46?.itbis3Base) === 1000);
        test('itbis3Amount persisted', Number(inv46?.itbis3Amount) === 0);
        test('transporteVia persisted', inv46?.transporteVia === '02');
        test('transportePaisOrigen persisted', inv46?.transportePaisOrigen === 'República Dominicana');
        test('transportePaisDestino persisted', inv46?.transportePaisDestino === 'Estados Unidos');
        test('transporteNombreCompania persisted', inv46?.transporteNombreCompania === 'Ocean Freight Co.');
        test('transporteNumeroViaje persisted', inv46?.transporteNumeroViaje === 'VY-2026-001');
        test('infoNombrePuertoEmbarque persisted', inv46?.infoNombrePuertoEmbarque === 'Puerto Haina');
        test('infoCondicionesEntrega persisted', inv46?.infoCondicionesEntrega === 'FOB');
        test('infoTotalFob persisted', Number(inv46?.infoTotalFob) === 1000);
        test('infoFlete persisted', Number(inv46?.infoFlete) === 200);
        test('infoTotalCif persisted', Number(inv46?.infoTotalCif) === 1250);
        test('infoRegimenAduanero persisted', inv46?.infoRegimenAduanero === 'EXPORTACION DEFINITIVA');

        // ============================================================
        // TIPO 47 — Pagos al Exterior (retención por línea obligatoria)
        // ============================================================
        console.log('\n--- e-CF 47: Pagos al Exterior ---');
        const res47 = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '47',
                receiverIdentificadorExtranjero: 'US-98765432',
                receiverName: 'Foreign Service Provider',
                totalIsrRetencion: 270.00,
                transporte: {
                    paisDestino: 'Estados Unidos'
                },
                items: [
                    {
                        description: 'Servicio del exterior',
                        quantity: 1,
                        unitPrice: 1000,
                        itbisRate: 0,
                        retencion: {
                            indicador: 1,
                            montoIsrRetenido: 270.00
                        }
                    }
                ]
            })
        });
        test('status 201', res47.status === 201, `got ${res47.status} ${JSON.stringify(res47.body?.error || {})}`);
        const inv47 = res47.body?.data?.invoice;
        test('type is 47', inv47?.type === '47');
        test('ncf starts with E47', inv47?.ncf?.startsWith('E47'));
        test('receiverIdentificadorExtranjero persisted', inv47?.receiverIdentificadorExtranjero === 'US-98765432');
        test('totalIsrRetencion persisted', Number(inv47?.totalIsrRetencion) === 270);
        test('transportePaisDestino persisted', inv47?.transportePaisDestino === 'Estados Unidos');
        test('transporteVia is null (reducido)', inv47?.transporteVia === null);

        // ============================================================
        // VALIDACIONES NEGATIVAS
        // ============================================================
        console.log('\n--- Validaciones negativas ---');

        const res43Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '43',
                receiverRnc: '130999888',
                receiverName: 'Alguien',
                exemptAmount: 500,
                items: [{ description: 'X', quantity: 1, unitPrice: 500, itbisRate: 0 }]
            })
        });
        test('43 with buyer rejected (400)', res43Bad.status === 400);

        const res46Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '46',
                receiverIdentificadorExtranjero: 'US-123',
                receiverName: 'Buyer',
                items: [{ description: 'X', quantity: 1, unitPrice: 100, itbisRate: 0 }]
            })
        });
        test('46 without itbis3Base rejected (400)', res46Bad.status === 400);

        const res44Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '44',
                exemptAmount: 500,
                items: [{ description: 'X', quantity: 1, unitPrice: 500, itbisRate: 0 }]
            })
        });
        test('44 without receiverName rejected (400)', res44Bad.status === 400);

        const res47Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '47',
                receiverName: 'Foreign',
                items: [{ description: 'X', quantity: 1, unitPrice: 100, itbisRate: 0 }]
            })
        });
        test('47 without foreign ID or RNC rejected (400)', res47Bad.status === 400);

        const res45Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '45',
                receiverName: 'Ministerio',
                items: [{ description: 'X', quantity: 1, unitPrice: 100, itbisRate: 18 }]
            })
        });
        test('45 without receiverRnc rejected (400)', res45Bad.status === 400);

        const res41Bad = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '41',
                receiverRnc: '130999888',
                receiverName: 'Proveedor',
                transporte: { paisDestino: 'US' },
                items: [
                    {
                        description: 'X',
                        quantity: 1,
                        unitPrice: 100,
                        itbisRate: 18,
                        retencion: { indicador: 1, montoItbisRetenido: 18 }
                    }
                ]
            })
        });
        test('41 with transporte rejected (400)', res41Bad.status === 400);

        // Retención prohibida en tipos distintos a 41/47
        const res43BadRet = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '43',
                exemptAmount: 500,
                items: [{
                    description: 'X',
                    quantity: 1,
                    unitPrice: 500,
                    itbisRate: 0,
                    retencion: { indicador: 1, montoItbisRetenido: 10 }
                }]
            })
        });
        test('43 with retencion rejected (400)', res43BadRet.status === 400);

        // 41 sin retención en la línea
        const res41BadNoRet = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '41',
                receiverRnc: '130999888',
                receiverName: 'Proveedor',
                totalItbisRetenido: 180,
                items: baseItems
            })
        });
        test('41 without retencion on line rejected (400)', res41BadNoRet.status === 400);

        // ============================================================
        // VERIFICACIÓN EN DB
        // ============================================================
        console.log('\n--- Verificación en DB ---');
        const count = await Invoice.count({ where: { companyId: testCompanyId } });
        test('6 invoices created in DB', count === 6, `got ${count}`);

        const db46 = await Invoice.findByPk(inv46.id);
        test('DB inv46 transporteVia preserved', db46.transporteVia === '02');
        test('DB inv46 infoTotalFob preserved', Number(db46.infoTotalFob) === 1000);

        const db47 = await Invoice.findByPk(inv47.id);
        test('DB inv47 totalIsrRetencion preserved', Number(db47.totalIsrRetencion) === 270);

        const db43 = await Invoice.findByPk(inv43.id);
        test('DB inv43 receiverRnc is null', db43.receiverRnc === null);

        // Verificación de retención por línea
        const lines41 = await InvoiceLine.findAll({
            where: { invoiceId: inv41.id },
            order: [['lineNumber', 'ASC']]
        });
        test('inv41 has 1 line', lines41.length === 1, `got ${lines41.length}`);
        test('inv41 line retencionIndicador=1', Number(lines41[0]?.retencionIndicador) === 1);
        test('inv41 line montoItbisRetenido=180', Number(lines41[0]?.montoItbisRetenido) === 180);
        test('inv41 line montoIsrRetenido=0', Number(lines41[0]?.montoIsrRetenido) === 0);

        const lines47 = await InvoiceLine.findAll({
            where: { invoiceId: inv47.id },
            order: [['lineNumber', 'ASC']]
        });
        test('inv47 has 1 line', lines47.length === 1, `got ${lines47.length}`);
        test('inv47 line retencionIndicador=1', Number(lines47[0]?.retencionIndicador) === 1);
        test('inv47 line montoIsrRetenido=270', Number(lines47[0]?.montoIsrRetenido) === 270);

        const lines46 = await InvoiceLine.findAll({ where: { invoiceId: inv46.id } });
        test('inv46 line has no retencion', lines46.every(l => l.retencionIndicador === null));

        // Audit logs de creación
        const auditCount = await AuditLog.count({
            where: {
                companyId: testCompanyId,
                action: 'invoice.created'
            }
        });
        test('6 audit logs invoice.created', auditCount === 6, `got ${auditCount}`);

        // Suscripción contador
        const subscription = await Subscription.findOne({ where: { companyId: testCompanyId } });
        test('invoicesUsedThisMonth is 6', Number(subscription.invoicesUsedThisMonth) === 6);

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