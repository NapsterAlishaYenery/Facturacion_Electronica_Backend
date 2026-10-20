// ============================================================
// Test de integración: POS quick invoice (FASE 17.2)
//
// Requiere el server corriendo en http://localhost:4001
//   node src/server.js
//
// Uso:
//   node test/integration/pos-quick-invoice.test.js
//
// Autocontenido: crea sus propias empresas (A y B), corre todos
// los tests y las borra al final. No depende de .env.
//
// Cobertura:
//   - 4 taxType: ITBIS_18, ITBIS_16, EXENTO, ITBIS_3
//   - Tipos 31, 32 (cobertura completa)
//   - Smoke test 33 (sin modifiedNcf → 400 delegado a createInvoiceSchema)
//   - Smoke test 46 (con ITBIS_3 → 201, 4to tax funcionando)
//   - Totales, itemCode copiado, XML generado
//   - Errores propios del POS: productId 404 (inexistente/ajeno/inactivo)
//   - Errores de alto nivel: 31 sin RNC/Nombre, 32 ≥250K sin RNC/Nombre
//   - 400 type inválido, 400 taxType inválido, 400 ITBIS_3 fuera de 46
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company,
    User,
    Product,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../src/models');
const { request } = require('../helpers/http.helper');

// ------------------------------------------------------------
// Constantes del test (RNC y emails únicos)
// ------------------------------------------------------------
const PASSWORD = 'Test1234!';

const RNC_A = '130999971';
const EMAIL_A = 'pos-quick-a@test.expedinap.com';

const RNC_B = '130999972';
const EMAIL_B = 'pos-quick-b@test.expedinap.com';

const OUR_ITEM_CODES = [
    'EMP-QUE-001', 'REF-20', 'AGU-001', 'VIEJO-001',
    'ITE-16-001', 'B-001'
];

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

// ------------------------------------------------------------
// Helper: extraer access_token del header Set-Cookie
// ------------------------------------------------------------
function extractAccessToken(setCookieHeader) {
    if (!setCookieHeader) return null;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const cookie of cookies) {
        const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookie) ||
                      /^access_token=([^;]+)/.exec(cookie);
        if (match) return match[1];
    }
    return null;
}

// ------------------------------------------------------------
// Helper: registrar empresa → token
// ------------------------------------------------------------
async function registerCompanyAndGetToken({ rnc, name, email }) {
    const res = await request('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company: { rnc, name, email, dgiiEnvironment: 'testecf' },
            owner: {
                email,
                password: PASSWORD,
                firstName: 'Test',
                lastName: 'Admin'
            }
        })
    });

    if (res.status !== 201) {
        throw new Error(
            `Register failed (${res.status}): ${JSON.stringify(res.body)}`
        );
    }

    const token = extractAccessToken(res.headers['set-cookie']);
    if (!token) {
        throw new Error('No access_token in Set-Cookie');
    }

    return {
        token,
        companyId: res.body?.data?.company?.id,
        userId: res.body?.data?.user?.id
    };
}

// ------------------------------------------------------------
// Helper: borrar empresa + todo lo asociado (CASCADE-friendly)
// ------------------------------------------------------------
async function purgeCompany(companyId) {
    if (!companyId) return;

    const invoices = await Invoice.findAll({
        where: { companyId },
        attributes: ['id']
    });
    const invIds = invoices.map(i => i.id);
    if (invIds.length > 0) {
        await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: invIds } } });
        await Invoice.destroy({ where: { id: { [Op.in]: invIds } } });
    }

    await Sequence.destroy({ where: { companyId } });
    await AuditLog.destroy({ where: { companyId } });
    await Product.destroy({ where: { companyId } });
    await User.destroy({ where: { companyId } });
    await Company.destroy({ where: { id: companyId } });
}

// ------------------------------------------------------------
// Helper: crear secuencia activa para un tipo
// ------------------------------------------------------------
async function createSequence(companyId, type) {
    return Sequence.create({
        companyId,
        type,
        prefix: `E${type}`,
        startNumber: 1,
        endNumber: 999999999,
        currentNumber: 0,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true
    });
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
(async () => {
    let A = null;
    let B = null;
    const createdInvoiceIds = [];

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ====================================================
        // SETUP: limpiar basura previa + crear A y B
        // ====================================================
        console.log('--- Setup: limpiar basura previa ---');
        const existingA = await Company.findOne({ where: { rnc: RNC_A } });
        if (existingA) await purgeCompany(existingA.id);
        const existingB = await Company.findOne({ where: { rnc: RNC_B } });
        if (existingB) await purgeCompany(existingB.id);
        console.log('  ✅ Sin basura previa\n');

        console.log('--- Setup: crear empresa A ---');
        A = await registerCompanyAndGetToken({
            rnc: RNC_A,
            name: 'POS Quick Test A SRL',
            email: EMAIL_A
        });
        test('empresa A creada', !!A.token && !!A.companyId);

        console.log('\n--- Setup: crear empresa B ---');
        B = await registerCompanyAndGetToken({
            rnc: RNC_B,
            name: 'POS Quick Test B SRL',
            email: EMAIL_B
        });
        test('empresa B creada', !!B.token && !!B.companyId);

        const authA = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${A.token}`
        };
        const authB = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${B.token}`
        };

        // Secuencias en A: 31, 32, 33, 46 (los tipos que probamos)
        for (const t of ['31', '32', '33', '46']) {
            await createSequence(A.companyId, t);
        }
        // Secuencia en B: 32 (para cross-tenant check)
        await createSequence(B.companyId, '32');
        console.log('  ✅ Secuencias creadas\n');

        // ====================================================
        // Productos en A
        // ====================================================
        const productEmpanada = await Product.create({
            companyId: A.companyId,
            name: 'Empanada de queso',
            price: 45.50,
            taxType: 'ITBIS_18',
            itemCode: 'EMP-QUE-001',
            isActive: true
        });
        const productRefresco = await Product.create({
            companyId: A.companyId,
            name: 'Refresco 20oz',
            price: 35.00,
            taxType: 'ITBIS_18',
            itemCode: 'REF-20',
            isActive: true
        });
        const productExento = await Product.create({
            companyId: A.companyId,
            name: 'Agua purificada',
            price: 25.00,
            taxType: 'EXENTO',
            itemCode: 'AGU-001',
            isActive: true
        });
        const productItbis16 = await Product.create({
            companyId: A.companyId,
            name: 'Yogur natural',
            price: 50.00,
            taxType: 'ITBIS_16',
            itemCode: 'ITE-16-001',
            isActive: true
        });
        const productInactivo = await Product.create({
            companyId: A.companyId,
            name: 'Producto viejo',
            price: 10.00,
            taxType: 'ITBIS_18',
            itemCode: 'VIEJO-001',
            isActive: false
        });
        const productB = await Product.create({
            companyId: B.companyId,
            name: 'Producto de B',
            price: 10.00,
            taxType: 'ITBIS_18',
            itemCode: 'B-001',
            isActive: true
        });
        console.log('  ✅ Productos creados\n');

        // ====================================================
        // TEST 1: solo productos (tipo 32)
        // ====================================================
        console.log('--- Test 1: solo productos (tipo 32) ---');
        const t1 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [
                    { productId: productEmpanada.id, quantity: 3 },
                    { productId: productRefresco.id, quantity: 1 }
                ]
            })
        });
        test('POST → 201', t1.status === 201,
            `got ${t1.status} ${JSON.stringify(t1.body)}`);

        const inv1 = t1.body?.data?.invoice;
        test('ncf generado', !!inv1?.ncf);
        test('type = 32', inv1?.type === '32');
        // 3*45.50 = 136.50 ; 1*35 = 35.00 ; base = 171.50 ; itbis 18% = 30.87 ; total 202.37
        test('total ≈ 202.37', Math.abs(Number(inv1?.total) - 202.37) < 0.01,
            `got ${inv1?.total}`);
        test('itbis ≈ 30.87', Math.abs(Number(inv1?.itbis) - 30.87) < 0.01,
            `got ${inv1?.itbis}`);
        test('2 líneas', inv1?.lines?.length === 2);
        test('XML generado', !!inv1?.xmlContent);
        if (inv1?.id) createdInvoiceIds.push(inv1.id);

        // itemCode copiado + indicador correcto
        const linesInv1 = await InvoiceLine.findAll({
            where: { invoiceId: inv1.id },
            order: [['lineNumber', 'ASC']]
        });
        test('itemCode EMP-QUE-001 en línea 1',
            linesInv1[0]?.itemCode === 'EMP-QUE-001');
        test('itemCode REF-20 en línea 2',
            linesInv1[1]?.itemCode === 'REF-20');
        test('indicadorFacturacion = 1 (18%)',
            Number(linesInv1[0]?.indicadorFacturacion) === 1);

        // ====================================================
        // TEST 2: solo manuales (tipo 32) con 18% + 16% + exento
        // ====================================================
        console.log('\n--- Test 2: manuales 18% + 16% + exento (tipo 32) ---');
        const t2 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [
                    { description: 'Catering 150p', unitPrice: 1000, quantity: 1, taxType: 'ITBIS_18' },
                    { description: 'Yogur (manual)', unitPrice: 100, quantity: 2, taxType: 'ITBIS_16' },
                    { description: 'Agua exenta', unitPrice: 25, quantity: 10, taxType: 'EXENTO' }
                ]
            })
        });
        test('POST → 201', t2.status === 201,
            `got ${t2.status} ${JSON.stringify(t2.body)}`);

        const inv2 = t2.body?.data?.invoice;
        // 1000*1.18 = 1180 ; 200*1.16 = 232 ; 250 exento ; total 1662
        test('total ≈ 1662.00', Math.abs(Number(inv2?.total) - 1662) < 0.01,
            `got ${inv2?.total}`);
        test('itbis1Base = 1000', Math.abs(Number(inv2?.itbis1Base) - 1000) < 0.01,
            `got ${inv2?.itbis1Base}`);
        test('itbis2Base = 200', Math.abs(Number(inv2?.itbis2Base) - 200) < 0.01,
            `got ${inv2?.itbis2Base}`);
        test('exemptAmount = 250', Math.abs(Number(inv2?.exemptAmount) - 250) < 0.01,
            `got ${inv2?.exemptAmount}`);
        if (inv2?.id) createdInvoiceIds.push(inv2.id);

        const linesInv2 = await InvoiceLine.findAll({
            where: { invoiceId: inv2.id },
            order: [['lineNumber', 'ASC']]
        });
        test('línea 1 indicador 1 (18%)',
            Number(linesInv2[0]?.indicadorFacturacion) === 1);
        test('línea 2 indicador 2 (16%)',
            Number(linesInv2[1]?.indicadorFacturacion) === 2);
        test('línea 3 indicador 4 (exento)',
            Number(linesInv2[2]?.indicadorFacturacion) === 4);

        // ====================================================
        // TEST 3: mixto (productos + manuales) tipo 31
        // ====================================================
        console.log('\n--- Test 3: mixto tipo 31 ---');
        const t3 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '31',
                receiverRnc: '131234567',
                receiverName: 'Cliente de Prueba SRL',
                items: [
                    { productId: productEmpanada.id, quantity: 2 },
                    { productId: productExento.id, quantity: 4 },
                    { description: 'Decoración de evento', unitPrice: 5000, quantity: 1, taxType: 'ITBIS_18' }
                ]
            })
        });
        test('POST → 201', t3.status === 201,
            `got ${t3.status} ${JSON.stringify(t3.body)}`);

        const inv3 = t3.body?.data?.invoice;
        test('receiverRnc = 131234567', inv3?.receiverRnc === '131234567');
        // 2*45.50 = 91 + 5000 = 5091 base 18% ; itbis = 916.38 ; exento = 100 ; total = 6107.38
        test('total ≈ 6107.38', Math.abs(Number(inv3?.total) - 6107.38) < 0.01,
            `got ${inv3?.total}`);
        if (inv3?.id) createdInvoiceIds.push(inv3.id);

        // ====================================================
        // TEST 4: producto con taxType ITBIS_16 facturado por productId
        // ====================================================
        console.log('\n--- Test 4: producto ITBIS_16 por productId ---');
        const t4 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ productId: productItbis16.id, quantity: 4 }]
            })
        });
        test('POST → 201', t4.status === 201,
            `got ${t4.status} ${JSON.stringify(t4.body)}`);

        const inv4 = t4.body?.data?.invoice;
        // 4*50 = 200 ; itbis 16% = 32 ; total 232
        test('total ≈ 232.00', Math.abs(Number(inv4?.total) - 232) < 0.01,
            `got ${inv4?.total}`);
        test('itbis2Base = 200', Math.abs(Number(inv4?.itbis2Base) - 200) < 0.01,
            `got ${inv4?.itbis2Base}`);
        if (inv4?.id) createdInvoiceIds.push(inv4.id);

        // ====================================================
        // TEST 5: 404 productId inexistente
        // ====================================================
        console.log('\n--- Test 5: 404 productId inexistente ---');
        const t5 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }]
            })
        });
        test('→ 404', t5.status === 404, `got ${t5.status}`);
        test('error code = PRODUCT_NOT_FOUND',
            t5.body?.error?.code === 'PRODUCT_NOT_FOUND');

        // ====================================================
        // TEST 6: 404 producto de otra empresa
        // ====================================================
        console.log('\n--- Test 6: 404 producto de otra empresa ---');
        const t6 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ productId: productB.id, quantity: 1 }]
            })
        });
        test('→ 404', t6.status === 404, `got ${t6.status}`);
        test('error code = PRODUCT_NOT_FOUND',
            t6.body?.error?.code === 'PRODUCT_NOT_FOUND');

        // ====================================================
        // TEST 7: 404 producto inactivo
        // ====================================================
        console.log('\n--- Test 7: 404 producto inactivo ---');
        const t7 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ productId: productInactivo.id, quantity: 1 }]
            })
        });
        test('→ 404', t7.status === 404, `got ${t7.status}`);
        test('error code = PRODUCT_NOT_FOUND',
            t7.body?.error?.code === 'PRODUCT_NOT_FOUND');

        // ====================================================
        // TEST 8: 400 tipo 31 sin receiverRnc
        // ====================================================
        console.log('\n--- Test 8: 400 tipo 31 sin receiverRnc ---');
        const t8 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '31',
                receiverName: 'Cliente sin RNC',
                items: [{ description: 'Servicio', unitPrice: 100, quantity: 1, taxType: 'ITBIS_18' }]
            })
        });
        test('→ 400', t8.status === 400, `got ${t8.status}`);
        test('details menciona receiverRnc',
            JSON.stringify(t8.body).includes('receiverRnc'));

        // ====================================================
        // TEST 9: 400 tipo 31 sin receiverName
        // ====================================================
        console.log('\n--- Test 9: 400 tipo 31 sin receiverName ---');
        const t9 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '31',
                receiverRnc: '131234567',
                items: [{ description: 'Servicio', unitPrice: 100, quantity: 1, taxType: 'ITBIS_18' }]
            })
        });
        test('→ 400', t9.status === 400, `got ${t9.status}`);
        test('details menciona receiverName',
            JSON.stringify(t9.body).includes('receiverName'));

        // ====================================================
        // TEST 10: 400 tipo 32 >= 250K sin RNC (productos)
        // ====================================================
        console.log('\n--- Test 10: 400 tipo 32 >= 250K sin RNC (productos) ---');
        const t10 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ productId: productEmpanada.id, quantity: 10000 }]
            })
        });
        test('→ 400', t10.status === 400, `got ${t10.status}`);
        const t10Body = JSON.stringify(t10.body);
        test('details menciona 250,000 / 250000',
            t10Body.includes('250,000') || t10Body.includes('250000'));

        // ====================================================
        // TEST 11: 400 tipo 32 >= 250K sin RNC (manuales)
        // Valida la pre-validación del schema (falla antes del servicio)
        // ====================================================
        console.log('\n--- Test 11: 400 tipo 32 >= 250K sin RNC (manuales) ---');
        const t11 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Servicio grande', unitPrice: 300000, quantity: 1, taxType: 'ITBIS_18' }]
            })
        });
        test('→ 400', t11.status === 400, `got ${t11.status}`);
        const t11Body = JSON.stringify(t11.body);
        test('details menciona 250,000 / 250000',
            t11Body.includes('250,000') || t11Body.includes('250000'));

        // ====================================================
        // TEST 12: 400 type inválido
        // ====================================================
        console.log('\n--- Test 12: 400 type inválido (99) ---');
        const t12 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '99',
                items: [{ description: 'X', unitPrice: 10, quantity: 1, taxType: 'ITBIS_18' }]
            })
        });
        test('→ 400', t12.status === 400, `got ${t12.status}`);
        test('details menciona type',
            JSON.stringify(t12.body).includes('type'));

        // ====================================================
        // TEST 13: 400 taxType inválido
        // ====================================================
        console.log('\n--- Test 13: 400 taxType inválido (IVA_21) ---');
        const t13 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'X', unitPrice: 10, quantity: 1, taxType: 'IVA_21' }]
            })
        });
        test('→ 400', t13.status === 400, `got ${t13.status}`);

        // ====================================================
        // TEST 14: 400 ITBIS_3 fuera de tipo 46
        // (createInvoiceSchema rechaza indicador 3 fuera de 46)
        // ====================================================
        console.log('\n--- Test 14: 400 ITBIS_3 fuera de tipo 46 ---');
        const t14 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '32',
                items: [{ description: 'Exportación', unitPrice: 100, quantity: 1, taxType: 'ITBIS_3' }]
            })
        });
        test('→ 400', t14.status === 400, `got ${t14.status}`);
        const t14Body = JSON.stringify(t14.body);
        test('details menciona indicador o tipo 46',
            t14Body.includes('indicador') || t14Body.includes('46'));

        // ====================================================
        // TEST 15: 400 tipo 33 sin modifiedNcf
        // (createInvoiceSchema exige modifiedNcf para 33/34)
        // Confirma que la delegación de validación funciona.
        // ====================================================
        console.log('\n--- Test 15: 400 tipo 33 sin modifiedNcf ---');
        const t15 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '33',
                receiverRnc: '131234567',
                receiverName: 'Cliente SRL',
                items: [{ description: 'Ajuste', unitPrice: 100, quantity: 1, taxType: 'ITBIS_18' }]
            })
        });
        test('→ 400', t15.status === 400, `got ${t15.status}`);
        test('details menciona NCF',
            JSON.stringify(t15.body).toLowerCase().includes('ncf'));

        // ====================================================
        // TEST 16: tipo 46 con ITBIS_3 → 201
        // Cubre el 4to tax funcionando en el único tipo donde aplica.
        // ====================================================
        console.log('\n--- Test 16: tipo 46 con ITBIS_3 → 201 ---');
        const t16 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '46',
                receiverName: 'Foreign Buyer Inc.',
                receiverIdentificadorExtranjero: 'US-123456',
                receiverPais: 'Estados Unidos',
                itbis3Base: 1000,
                itbis3Amount: 0,
                items: [
                    {
                        description: 'Export service',
                        unitPrice: 1000,
                        quantity: 1,
                        taxType: 'ITBIS_3'
                    }
                ]
            })
        });
        test('POST → 201', t16.status === 201,
            `got ${t16.status} ${JSON.stringify(t16.body)}`);

        const inv16 = t16.body?.data?.invoice;
        test('type = 46', inv16?.type === '46');
        if (inv16?.id) createdInvoiceIds.push(inv16.id);

        // Verificar indicador 3 en línea
        if (inv16?.id) {
            const lines16 = await InvoiceLine.findAll({
                where: { invoiceId: inv16.id }
            });
            test('1 línea con indicador 3',
                lines16.length === 1 &&
                Number(lines16[0]?.indicadorFacturacion) === 3);
        }

        // ====================================================
        // TEST 17: 404 producto de B con type 46 (multi-tenant)
        // ====================================================
        console.log('\n--- Test 17: 404 producto de B con type 46 ---');
        const t17 = await request('/api/pos/quick', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                type: '46',
                receiverName: 'Foreign Buyer Inc.',
                receiverIdentificadorExtranjero: 'US-123456',
                receiverPais: 'US',
                itbis3Base: 100,
                itbis3Amount: 0,
                items: [{ productId: productB.id, quantity: 1 }]
            })
        });
        test('→ 404 (producto de B)', t17.status === 404, `got ${t17.status}`);

        // ====================================================
        // TEST 18: audit logs de invoice.created
        // ====================================================
        console.log('\n--- Test 18: audit logs invoice.created ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: A.companyId,
                action: 'invoice.created',
                entityId: { [Op.in]: createdInvoiceIds }
            }
        });
        test('audit logs = número de facturas creadas',
            auditCount === createdInvoiceIds.length,
            `got ${auditCount}, expected ${createdInvoiceIds.length}`);

        // ====================================================
        // TEST 19: NCFs únicos
        // ====================================================
        console.log('\n--- Test 19: NCFs únicos ---');
        const ncfSet = new Set();
        for (const id of createdInvoiceIds) {
            const inv = await Invoice.findByPk(id, { attributes: ['ncf'] });
            if (inv) ncfSet.add(inv.ncf);
        }
        test('todos los NCFs son únicos',
            ncfSet.size === createdInvoiceIds.length,
            `got ${ncfSet.size} únicos de ${createdInvoiceIds.length}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            // Limpiar facturas creadas por el test
            if (createdInvoiceIds.length > 0) {
                await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: createdInvoiceIds } } });
                await Invoice.destroy({ where: { id: { [Op.in]: createdInvoiceIds } } });
                await AuditLog.destroy({
                    where: { entityId: { [Op.in]: createdInvoiceIds } }
                });
            }

            // Borrar empresas A y B completas (created por el test)
            if (A?.companyId) await purgeCompany(A.companyId);
            if (B?.companyId) await purgeCompany(B.companyId);

            console.log('\n🧹 Cleaned up (empresas A y B)');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        await sequelize.close();
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();