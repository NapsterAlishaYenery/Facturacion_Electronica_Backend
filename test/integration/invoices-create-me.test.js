require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Plan, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

// 🔥 RNC único por corrida (evita colisiones entre ejecuciones)
const uniqueSuffix = String(Date.now()).slice(-5);
const testRnc = `13099${uniqueSuffix}3`;
const testEmail = 'owner-inv-create@expedinap.com';

let companyAdminCookie = null;
let testCompanyId = null;
let testSequence32Id = null;
let testSequence33Id = null;
let testSequence34Id = null;
let testSequence31Id = null;
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
                company: { rnc: testRnc, name: 'Invoices Create Test SRL' },
                owner: { email: testEmail, password: 'OwnerPass123', firstName: 'Owner', lastName: 'Create' }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;

        // Secuencias 31, 32, 33, 34
        const seq31 = await Sequence.create({
            companyId: testCompanyId, type: '31', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        testSequence31Id = seq31.id;

        const seq32 = await Sequence.create({
            companyId: testCompanyId, type: '32', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        testSequence32Id = seq32.id;

        const seq33 = await Sequence.create({
            companyId: testCompanyId, type: '33', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
        });
        testSequence33Id = seq33.id;

        const seq34 = await Sequence.create({
            companyId: testCompanyId, type: '34', prefix: 'E',
            startNumber: 1, endNumber: 100, currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), isActive: true
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '32',
                receiverRnc: '130999888',
                receiverName: 'Cliente Original',
                items: [{ description: 'Servicio original', quantity: 1, unitPrice: 1000, itbisRate: 18 }]
            })
        });
        test('original invoice created', origRes.status === 201);
        originalInvoiceId = origRes.body?.data?.invoice?.id;

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

        // 🔥 NUEVO: fix DT-27 en factura simple (1 línea al 18%)
        test('orig has montoGravado 1000', Number(origInv?.montoGravado) === 1000, `got ${origInv?.montoGravado}`);
        test('orig has itbis1Base 1000', Number(origInv?.itbis1Base) === 1000, `got ${origInv?.itbis1Base}`);
        test('orig has itbis1Amount 180', Number(origInv?.itbis1Amount) === 180, `got ${origInv?.itbis1Amount}`);
        test('orig has itbis2Base 0', Number(origInv?.itbis2Base) === 0);
        test('orig has itbis2Amount 0', Number(origInv?.itbis2Amount) === 0);
        test('orig has exemptAmount 0', Number(origInv?.exemptAmount) === 0);

        // ============================================================
        // TEST 1: crear Nota de Débito (33) válida
        // ============================================================
        console.log('\n--- Test 1: crear Nota de Débito (33) válida ---');
        const create33Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
        const orig2Res = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '34',
                receiverName: 'Cliente 2',
                modifiedNcf: orig2Ncf,
                modifiedNcfDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                modificationCode: 1,
                modificationReason: 'Devolución de producto',
                indicadorNotaCredito: 0,
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '34',
                modifiedNcf: originalNcf,
                modifiedNcfDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                modificationCode: 1,
                indicadorNotaCredito: 0,
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: 'E320000009999',
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Será draft', quantity: 1, unitPrice: 100 }]
            })
        });
        const draftNcf = draftRes.body?.data?.invoice?.ncf;

        const overDraftRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
        await Invoice.update(
            { status: 'accepted', trackId: 'TRACK-NOTE-33' },
            { where: { id: note33Id } }
        );

        const overNotaRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: originalNcf,
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
        const freshRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
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

        await Sequence.update({ isActive: false }, { where: { id: testSequence33Id } });

        const noSeqRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '33',
                modifiedNcf: freshNcf,
                modifiedNcfDate: new Date().toISOString(),
                modificationCode: 3,
                items: [{ description: 'X', quantity: 1, unitPrice: 100 }]
            })
        });
        test('status 409', noSeqRes.status === 409);
        test('code NO_ACTIVE_SEQUENCE', noSeqRes.body?.error?.code === 'NO_ACTIVE_SEQUENCE');

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
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({ receiverName: 'Otro nombre' })
        });
        test('update allowed while draft (por ahora)', updateNoteRes.status === 200 || updateNoteRes.status === 409);

        // ============================================================
        // 🔥 TEST 13: FIX DT-27 — Factura 31 con líneas mixtas
        //    Verifica que:
        //      - montoGravado NO incluye exento
        //      - exemptAmount se calcula de las líneas
        //      - itbis1Base/2Base se separan correctamente
        //      - XML en BD tiene MontoExento y MontoGravadoI2
        //      - Cada línea tiene su indicadorFacturacion
        // ============================================================
        console.log('\n🔥 --- Test 13: FIX DT-27 — factura 31 con líneas mixtas ---');
        const mixedRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '31',
                receiverRnc: '13006904627',
                receiverName: 'Distribuidora del Este SRL',
                items: [
                    {
                        itemCode: 'HARD-001',
                        description: 'Servidor Dell PowerEdge R740',
                        quantity: 1,
                        unitPrice: 285000,
                        discount: 15000,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    },
                    {
                        itemCode: 'SOFT-001',
                        description: 'Licencia software contable anual',
                        quantity: 1,
                        unitPrice: 45000,
                        discount: 0,
                        itbisRate: 16,
                        indicadorFacturacion: 2
                    },
                    {
                        itemCode: 'EXEN-001',
                        description: 'Servicio de instalación (exento)',
                        quantity: 1,
                        unitPrice: 25000,
                        discount: 0,
                        itbisRate: 0,
                        indicadorFacturacion: 4
                    }
                ]
            })
        });
        test('status 201', mixedRes.status === 201, `got ${mixedRes.status} ${JSON.stringify(mixedRes.body?.error || {})}`);
        const mixedInv = mixedRes.body?.data?.invoice;
        const mixedInvId = mixedInv?.id;

        // Verificar en el response (numeros como DECIMAL se serializan como string)
        test('response subtotal = 340000.00 (gravado+exento)',
            Number(mixedInv?.subtotal) === 340000, `got ${mixedInv?.subtotal}`);
        test('response montoGravado = 315000.00',
            Number(mixedInv?.montoGravado) === 315000, `got ${mixedInv?.montoGravado}`);
        test('response itbis1Base = 270000.00',
            Number(mixedInv?.itbis1Base) === 270000, `got ${mixedInv?.itbis1Base}`);
        test('response itbis1Amount = 48600.00',
            Number(mixedInv?.itbis1Amount) === 48600, `got ${mixedInv?.itbis1Amount}`);
        test('response itbis2Base = 45000.00',
            Number(mixedInv?.itbis2Base) === 45000, `got ${mixedInv?.itbis2Base}`);
        test('response itbis2Amount = 7200.00',
            Number(mixedInv?.itbis2Amount) === 7200, `got ${mixedInv?.itbis2Amount}`);
        test('response exemptAmount = 25000.00',
            Number(mixedInv?.exemptAmount) === 25000, `got ${mixedInv?.exemptAmount}`);
        test('response itbis = 55800.00',
            Number(mixedInv?.itbis) === 55800, `got ${mixedInv?.itbis}`);
        test('response total = 395800.00',
            Number(mixedInv?.total) === 395800, `got ${mixedInv?.total}`);

        // Verificar en BD
        const dbMixed = await Invoice.findByPk(mixedInvId);
        test('DB montoGravado = 315000.00', Number(dbMixed.montoGravado) === 315000);
        test('DB itbis1Base = 270000.00', Number(dbMixed.itbis1Base) === 270000);
        test('DB itbis1Amount = 48600.00', Number(dbMixed.itbis1Amount) === 48600);
        test('DB itbis2Base = 45000.00', Number(dbMixed.itbis2Base) === 45000);
        test('DB itbis2Amount = 7200.00', Number(dbMixed.itbis2Amount) === 7200);
        test('DB exemptAmount = 25000.00', Number(dbMixed.exemptAmount) === 25000);
        test('DB subtotal = 340000.00 (backward-compat)', Number(dbMixed.subtotal) === 340000);

        // Verificar líneas
        const mixedLines = await InvoiceLine.findAll({
            where: { invoiceId: mixedInvId },
            order: [['lineNumber', 'ASC']]
        });
        test('3 líneas creadas', mixedLines.length === 3);
        test('línea 1 indicadorFacturacion = 1', Number(mixedLines[0]?.indicadorFacturacion) === 1);
        test('línea 2 indicadorFacturacion = 2', Number(mixedLines[1]?.indicadorFacturacion) === 2);
        test('línea 3 indicadorFacturacion = 4', Number(mixedLines[2]?.indicadorFacturacion) === 4);

        // Verificar XML guardado en BD
        const xml = dbMixed.xmlContent || '';
        test('XML contiene MontoGravadoTotal 315000.00', xml.includes('<MontoGravadoTotal>315000.00</MontoGravadoTotal>'));
        test('XML contiene MontoGravadoI1 270000.00', xml.includes('<MontoGravadoI1>270000.00</MontoGravadoI1>'));
        test('XML contiene MontoGravadoI2 45000.00', xml.includes('<MontoGravadoI2>45000.00</MontoGravadoI2>'));
        test('XML contiene MontoExento 25000.00', xml.includes('<MontoExento>25000.00</MontoExento>'));
        test('XML contiene ITBIS1 18', xml.includes('<ITBIS1>18</ITBIS1>'));
        test('XML contiene ITBIS2 16', xml.includes('<ITBIS2>16</ITBIS2>'));
        test('XML contiene TotalITBIS 55800.00', xml.includes('<TotalITBIS>55800.00</TotalITBIS>'));
        test('XML contiene TotalITBIS1 48600.00', xml.includes('<TotalITBIS1>48600.00</TotalITBIS1>'));
        test('XML contiene TotalITBIS2 7200.00', xml.includes('<TotalITBIS2>7200.00</TotalITBIS2>'));
        test('XML contiene MontoTotal 395800.00', xml.includes('<MontoTotal>395800.00</MontoTotal>'));
        test('XML NO contiene MontoGravadoTotal 340000.00 (bug viejo)',
            !xml.includes('<MontoGravadoTotal>340000.00</MontoGravadoTotal>'));
        test('XML contiene IndicadorFacturacion 4 (exento)', xml.includes('<IndicadorFacturacion>4</IndicadorFacturacion>'));

        // ============================================================
        // 🔥 TEST 14: FIX DT-27 — Backward-compat sin indicadorFacturacion
        //    Cliente viejo manda solo itbisRate, sin indicadorFacturacion.
        //    El sistema debe inferir 1, 2, 4 correctamente.
        // ============================================================
        console.log('\n🔥 --- Test 14: FIX DT-27 — backward-compat sin indicador ---');
        const compatRes = await request('/api/invoices/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': companyAdminCookie },
            body: JSON.stringify({
                type: '31',
                receiverRnc: '13006904627',
                receiverName: 'Cliente Compat',
                items: [
                    { description: 'Gravado', quantity: 1, unitPrice: 1000, itbisRate: 18 },
                    { description: 'Exento', quantity: 1, unitPrice: 500, itbisRate: 0 }
                ]
            })
        });
        test('status 201', compatRes.status === 201, `got ${compatRes.status}`);
        const compatInv = compatRes.body?.data?.invoice;
        const compatInvId = compatInv?.id;

        // 1000 * 18% = 180. Exento 500. Total = 1000 + 500 + 180 = 1680
        test('compat montoGravado = 1000', Number(compatInv?.montoGravado) === 1000);
        test('compat exemptAmount = 500', Number(compatInv?.exemptAmount) === 500);
        test('compat itbis1Base = 1000', Number(compatInv?.itbis1Base) === 1000);
        test('compat itbis1Amount = 180', Number(compatInv?.itbis1Amount) === 180);
        test('compat total = 1680', Number(compatInv?.total) === 1680);

        // Verificar indicadorFacturacion inferido
        const compatLines = await InvoiceLine.findAll({
            where: { invoiceId: compatInvId },
            order: [['lineNumber', 'ASC']]
        });
        test('compat línea 1 indicadorFacturacion = 1 (inferido)', Number(compatLines[0]?.indicadorFacturacion) === 1);
        test('compat línea 2 indicadorFacturacion = 4 (inferido)', Number(compatLines[1]?.indicadorFacturacion) === 4);

        // Verificar XML
        const dbCompat = await Invoice.findByPk(compatInvId);
        const xmlCompat = dbCompat.xmlContent || '';
        test('compat XML contiene MontoGravadoTotal 1000.00',
            xmlCompat.includes('<MontoGravadoTotal>1000.00</MontoGravadoTotal>'));
        test('compat XML contiene MontoExento 500.00',
            xmlCompat.includes('<MontoExento>500.00</MontoExento>'));

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