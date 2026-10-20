// ============================================================
// Test de integración: API Keys end-to-end (FASE 18.3)
//
// Requiere el server corriendo en http://localhost:4001
//   node src/server.js
//
// Uso:
//   node test/integration/api-keys-e2e.test.js
//
// Autocontenido: crea empresa enterprise + basic + B, corre
// todos los tests y limpia al final.
//
// Cobertura:
//   - Crear API Key con JWT (empresa enterprise)
//   - Empresa basic NO puede crear API Key (403)
//   - Facturar por /api/pos/quick con API Key (tipo 32)
//   - Facturar por /api/invoices/me con API Key (tipo 31)
//   - CRUD productos con API Key
//   - API Key NO puede tocar rutas de admin global (/api/invoices
//     sin /me) → 403 por roleMiddleware
//   - Revocar key → 401 al usarla de nuevo
//   - Cross-tenant: key de B no ve datos de A
//   - Audit logs de api_key.created / api_key.revoked
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company,
    User,
    Plan,
    Subscription,
    Product,
    Sequence,
    Invoice,
    InvoiceLine,
    ApiKey,
    AuditLog
} = require('../../src/models');
const { request } = require('../helpers/http.helper');

const PASSWORD = 'Test1234!';
const RNC_ENTERPRISE = '130999961';
const EMAIL_ENTERPRISE = 'api-keys-e2e-ent@test.expedinap.com';
const RNC_BASIC = '130999962';
const EMAIL_BASIC = 'api-keys-e2e-basic@test.expedinap.com';
const RNC_B = '130999963';
const EMAIL_B = 'api-keys-e2e-b@test.expedinap.com';

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

async function registerCompanyAndGetToken({ rnc, name, email }) {
    const res = await request('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company: { rnc, name, email, dgiiEnvironment: 'testecf' },
            owner: { email, password: PASSWORD, firstName: 'Test', lastName: 'Admin' }
        })
    });

    if (res.status !== 201) {
        throw new Error(`Register failed (${res.status}): ${JSON.stringify(res.body)}`);
    }

    const token = extractAccessToken(res.headers['set-cookie']);
    if (!token) throw new Error('No access_token in Set-Cookie');

    return {
        token,
        companyId: res.body?.data?.company?.id,
        userId: res.body?.data?.user?.id
    };
}

async function purgeCompany(companyId) {
    if (!companyId) return;

    const invoices = await Invoice.findAll({
        where: { companyId }, attributes: ['id']
    });
    const invIds = invoices.map(i => i.id);
    if (invIds.length > 0) {
        await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: invIds } } });
        await Invoice.destroy({ where: { id: { [Op.in]: invIds } } });
    }

    await Sequence.destroy({ where: { companyId } });
    await AuditLog.destroy({ where: { companyId } });
    await Product.destroy({ where: { companyId } });
    await ApiKey.destroy({ where: { companyId } });
    await Subscription.destroy({ where: { companyId } });
    await User.destroy({ where: { companyId } });
    await Company.destroy({ where: { id: companyId } });
}

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

async function setPlan(companyId, planCode) {
    const plan = await Plan.findOne({ where: { code: planCode, isActive: true } });
    if (!plan) throw new Error(`Plan "${planCode}" not found`);

    const sub = await Subscription.findOne({
        where: { companyId },
        order: [['createdAt', 'DESC']]
    });
    if (!sub) throw new Error(`No subscription for company ${companyId}`);

    await sub.update({ planId: plan.id, status: 'active', trialEndsAt: null });
    return plan;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
(async () => {
    let ENT = null, BASIC = null, B = null;
    const createdInvoiceIds = [];

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ====================================================
        // Setup
        // ====================================================
        console.log('--- Setup: limpiar basura previa ---');
        for (const rnc of [RNC_ENTERPRISE, RNC_BASIC, RNC_B]) {
            const existing = await Company.findOne({ where: { rnc } });
            if (existing) await purgeCompany(existing.id);
        }
        console.log('  ✅ Sin basura previa\n');

        console.log('--- Setup: crear empresas ---');
        ENT = await registerCompanyAndGetToken({
            rnc: RNC_ENTERPRISE, name: 'API Keys E2E Enterprise SRL',
            email: EMAIL_ENTERPRISE
        });
        BASIC = await registerCompanyAndGetToken({
            rnc: RNC_BASIC, name: 'API Keys E2E Basic SRL',
            email: EMAIL_BASIC
        });
        B = await registerCompanyAndGetToken({
            rnc: RNC_B, name: 'API Keys E2E B SRL',
            email: EMAIL_B
        });
        test('empresa enterprise creada', !!ENT.token);
        test('empresa basic creada', !!BASIC.token);
        test('empresa B creada', !!B.token);

        await setPlan(ENT.companyId, 'enterprise');
        await setPlan(BASIC.companyId, 'basic');
        await setPlan(B.companyId, 'enterprise');
        console.log('  ✅ Planes forzados\n');

        await createSequence(ENT.companyId, '32');
        await createSequence(ENT.companyId, '31');
        await createSequence(B.companyId, '32');
        console.log('  ✅ Secuencias creadas\n');

        const product = await Product.create({
            companyId: ENT.companyId,
            name: 'Empanada E2E',
            price: 45.50,
            taxType: 'ITBIS_18',
            itemCode: 'E2E-EMP-001',
            isActive: true
        });
        console.log('  ✅ Producto creado\n');

        const authENT = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ENT.token}`
        };
        const authBASIC = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BASIC.token}`
        };

        // ====================================================
        // TEST 1: BASIC no puede crear API Key
        // ====================================================
        console.log('--- Test 1: BASIC no puede crear API Key ---');
        const t1 = await request('/api/api-keys', {
            method: 'POST',
            headers: authBASIC,
            body: JSON.stringify({ name: 'Test BASIC' })
        });
        test('→ 403', t1.status === 403, `got ${t1.status}`);
        test('code API_ACCESS_NOT_IN_PLAN',
            t1.body?.error?.code === 'API_ACCESS_NOT_IN_PLAN',
            `got ${t1.body?.error?.code}`);

        // ====================================================
        // TEST 2: ENTERPRISE crea API Key
        // ====================================================
        console.log('\n--- Test 2: ENTERPRISE crea API Key ---');
        const t2 = await request('/api/api-keys', {
            method: 'POST',
            headers: authENT,
            body: JSON.stringify({
                name: 'POS del supermercado',
                expiresInDays: 365
            })
        });
        test('→ 201', t2.status === 201,
            `got ${t2.status} ${JSON.stringify(t2.body)}`);

        const apiKey = t2.body?.data;
        test('secret empieza con pk_test_',
            apiKey?.secret?.startsWith('pk_test_'));
        test('keyPrefix coincide con inicio del secret',
            apiKey?.secret?.startsWith(apiKey?.keyPrefix));
        test('expiresAt en el futuro', new Date(apiKey?.expiresAt) > new Date());

        const rawSecret = apiKey.secret;
        const apiKeyId = apiKey.id;

        // ====================================================
        // TEST 3: listar keys
        // ====================================================
        console.log('\n--- Test 3: listar keys ---');
        const t3 = await request('/api/api-keys', { headers: authENT });
        test('→ 200', t3.status === 200);
        const keys = t3.body?.data?.apiKeys || [];
        test('1 key en lista', keys.length === 1);
        test('lista NO contiene secret',
            keys.every(k => !('secret' in k)));
        test('lista NO contiene keyHash',
            keys.every(k => !('keyHash' in k)));
        test('lista contiene keyPrefix', !!keys[0]?.keyPrefix);

        // ====================================================
        // TEST 4: facturar tipo 32 por /api/pos/quick con API Key
        // ====================================================
        console.log('\n--- Test 4: facturar /api/pos/quick con API Key ---');
        const t4 = await request('/api/pos/quick', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': rawSecret
            },
            body: JSON.stringify({
                type: '32',
                items: [{ productId: product.id, quantity: 3 }]
            })
        });
        test('→ 201', t4.status === 201,
            `got ${t4.status} ${JSON.stringify(t4.body)}`);

        const inv4 = t4.body?.data?.invoice;
        test('factura tiene NCF', !!inv4?.ncf);
        test('total ≈ 161.07', Math.abs(Number(inv4?.total) - 161.07) < 0.01,
            `got ${inv4?.total}`);
        test('XML generado', !!inv4?.xmlContent);
        if (inv4?.id) createdInvoiceIds.push(inv4.id);

        const audit4 = await AuditLog.findOne({
            where: { action: 'invoice.created', entityId: inv4.id }
        });
        test('audit log tiene userId (admin vía API Key)',
            !!audit4?.userId,
            `got userId=${audit4?.userId}`);

        // ====================================================
        // TEST 5: facturar tipo 31 por /api/invoices/me con API Key
        // ====================================================
        console.log('\n--- Test 5: facturar /api/invoices/me con API Key ---');
        const t5 = await request('/api/invoices/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': rawSecret
            },
            body: JSON.stringify({
                type: '31',
                receiverRnc: '131234567',
                receiverName: 'Cliente E2E SRL',
                items: [{
                    description: 'Servicio E2E',
                    quantity: 1,
                    unitPrice: 1000,
                    discount: 0,
                    itbisRate: 18,
                    indicadorFacturacion: 1
                }]
            })
        });
        test('→ 201', t5.status === 201,
            `got ${t5.status} ${JSON.stringify(t5.body)}`);

        const inv5 = t5.body?.data?.invoice;
        test('factura tiene NCF', !!inv5?.ncf);
        test('total ≈ 1180', Math.abs(Number(inv5?.total) - 1180) < 0.01);
        if (inv5?.id) createdInvoiceIds.push(inv5.id);

        // ====================================================
        // TEST 6: CRUD productos con API Key
        // ====================================================
        console.log('\n--- Test 6: CRUD producto con API Key ---');
        const t6create = await request('/api/products/me', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': rawSecret
            },
            body: JSON.stringify({
                name: 'Producto E2E nuevo',
                price: 99,
                taxType: 'ITBIS_18',
                itemCode: 'E2E-NEW-001'
            })
        });
        test('POST producto → 201', t6create.status === 201,
            `got ${t6create.status}`);
        const newProductId = t6create.body?.data?.product?.id;

        const t6update = await request(`/api/products/me/${newProductId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': rawSecret
            },
            body: JSON.stringify({ price: 120 })
        });
        test('PATCH producto → 200', t6update.status === 200);
        test('precio actualizado',
            Number(t6update.body?.data?.product?.price) === 120);

        // ====================================================
        // TEST 7: API Key NO puede tocar rutas de admin global
        // (GET /api/invoices sin /me → roleMiddleware('admin') → 403)
        // ====================================================
        console.log('\n--- Test 7: API Key bloqueada en admin global ---');
        const t7 = await request('/api/invoices', {
            headers: { 'X-API-Key': rawSecret }
        });
        test('GET /api/invoices (admin) → 403', t7.status === 403,
            `got ${t7.status} ${JSON.stringify(t7.body)}`);
        test('code INSUFFICIENT_ROLE',
            t7.body?.error?.code === 'INSUFFICIENT_ROLE',
            `got ${t7.body?.error?.code}`);

        // ====================================================
        // TEST 8: revocar key
        // ====================================================
        console.log('\n--- Test 8: revocar key ---');
        const t8 = await request(`/api/api-keys/${apiKeyId}/revoke`, {
            method: 'PATCH',
            headers: authENT
        });
        test('→ 200', t8.status === 200,
            `got ${t8.status} ${JSON.stringify(t8.body)}`);
        test('revokedAt presente', !!t8.body?.data?.revokedAt);

        // ====================================================
        // TEST 9: usar key revocada → 401
        // ====================================================
        console.log('\n--- Test 9: usar key revocada ---');
        const t9 = await request('/api/pos/quick', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': rawSecret
            },
            body: JSON.stringify({
                type: '32',
                items: [{ productId: product.id, quantity: 1 }]
            })
        });
        test('→ 401', t9.status === 401, `got ${t9.status}`);
        test('code INVALID_API_KEY',
            t9.body?.error?.code === 'INVALID_API_KEY');

        // ====================================================
        // TEST 10: key de B solo ve datos de B (cross-tenant)
        // ====================================================
        console.log('\n--- Test 10: cross-tenant ---');
        const authB = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${B.token}`
        };
        const t10create = await request('/api/api-keys', {
            method: 'POST',
            headers: authB,
            body: JSON.stringify({ name: 'POS B' })
        });
        test('B crea key → 201', t10create.status === 201);
        const secretB = t10create.body?.data?.secret;

        const t10list = await request('/api/invoices/me', {
            headers: { 'X-API-Key': secretB }
        });
        test('B ve 0 facturas (no ve las de A)',
            t10list.status === 200 &&
            (t10list.body?.data?.items || []).length === 0,
            `got ${t10list.body?.data?.items?.length}`);

        // ====================================================
        // TEST 11: audit logs
        // ====================================================
        console.log('\n--- Test 11: audit logs ---');
        const createdCount = await AuditLog.count({
            where: { companyId: ENT.companyId, action: 'api_key.created' }
        });
        const revokedCount = await AuditLog.count({
            where: { companyId: ENT.companyId, action: 'api_key.revoked' }
        });
        test('audit api_key.created >= 1', createdCount >= 1,
            `got ${createdCount}`);
        test('audit api_key.revoked >= 1', revokedCount >= 1,
            `got ${revokedCount}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            if (createdInvoiceIds.length > 0) {
                await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: createdInvoiceIds } } });
                await Invoice.destroy({ where: { id: { [Op.in]: createdInvoiceIds } } });
                await AuditLog.destroy({
                    where: { entityId: { [Op.in]: createdInvoiceIds } }
                });
            }

            if (ENT?.companyId) await purgeCompany(ENT.companyId);
            if (BASIC?.companyId) await purgeCompany(BASIC.companyId);
            if (B?.companyId) await purgeCompany(B.companyId);

            console.log('\n🧹 Cleaned up (3 empresas)');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        await sequelize.close();
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();