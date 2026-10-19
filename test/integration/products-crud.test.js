// ============================================================
// Test de integración: products CRUD (con multi-tenant real)
//
// Requiere el server corriendo en http://localhost:4001
//   node src/server.js
//
// Uso:
//   node test/integration/products-crud.test.js
//
// Flujo realista:
//   1. Registra empresa A + admin A vía /api/auth/register-company
//   2. Registra empresa B + admin B (para tests multi-tenant)
//   3. Extrae access_token del header Set-Cookie
//   4. Ejecuta el CRUD completo sobre A
//   5. Verifica aislamiento cruzado (A no puede ver/tocar productos de B)
//   6. Limpia todo
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company,
    User,
    Product,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../src/models');
const { request } = require('../helpers/http.helper');

// ------------------------------------------------------------
// Constantes del test (RNC y emails únicos, no chocan con reales)
// ------------------------------------------------------------
const RNC_A = '130999991';
const RNC_B = '130999992';
const EMAIL_A = 'products-crud-a@test.expedinap.com';
const EMAIL_B = 'products-crud-b@test.expedinap.com';
const PASSWORD = 'Test1234!';

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
// El controller NO devuelve el token en el body; solo setea
// cookies httpOnly. Esto es lo que hace el navegador.
// ------------------------------------------------------------
function extractAccessToken(setCookieHeader) {
    if (!setCookieHeader) return null;

    // set-cookie puede ser un array (varias cookies) o un string
    const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];

    for (const cookie of cookies) {
        // Formato: "access_token=XXXX; Path=/; HttpOnly; ..."
        const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookie) ||
                      /^access_token=([^;]+)/.exec(cookie);
        if (match) {
            return match[1];
        }
    }
    return null;
}

// ------------------------------------------------------------
// Cleanup (orden importa por FKs)
// ------------------------------------------------------------
async function cleanup() {
    const companies = await Company.findAll({
        where: { rnc: { [Op.in]: [RNC_A, RNC_B] } }
    });
    const ids = companies.map(c => c.id);
    if (ids.length === 0) return;

    // invoice_lines → invoices (por si el test de PRODUCT_HAS_INVOICES creó algo)
    const invoices = await Invoice.findAll({
        where: { companyId: { [Op.in]: ids } },
        attributes: ['id']
    });
    const invoiceIds = invoices.map(i => i.id);
    if (invoiceIds.length > 0) {
        await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: invoiceIds } } });
        await Invoice.destroy({ where: { id: { [Op.in]: invoiceIds } } });
    }

    await AuditLog.destroy({ where: { companyId: { [Op.in]: ids } } });
    await Product.destroy({ where: { companyId: { [Op.in]: ids } } });
    await User.destroy({ where: { companyId: { [Op.in]: ids } } });
    await Company.destroy({ where: { id: { [Op.in]: ids } } });
}

// ------------------------------------------------------------
// Helper: registrar empresa + admin y devolver token
// ------------------------------------------------------------
async function registerCompanyAndGetToken({ rnc, name, email }) {
    const res = await request('/api/auth/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company: {
                rnc,
                name,
                email,
                dgiiEnvironment: 'testecf'
            },
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
        throw new Error(
            `No access_token in Set-Cookie. Headers: ${JSON.stringify(res.headers)}`
        );
    }

    return {
        token,
        companyId: res.body?.data?.company?.id,
        userId: res.body?.data?.user?.id
    };
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await cleanup();
        console.log('✅ Previous test data cleaned\n');

        // ====================================================
        // SETUP: 2 empresas (A y B) para multi-tenant
        // ====================================================
        console.log('--- Setup: registrar empresas A y B ---');
        const A = await registerCompanyAndGetToken({
            rnc: RNC_A,
            name: 'Products CRUD Test A SRL',
            email: EMAIL_A
        });
        const B = await registerCompanyAndGetToken({
            rnc: RNC_B,
            name: 'Products CRUD Test B SRL',
            email: EMAIL_B
        });
        test('empresa A registrada + token', !!A.token && !!A.companyId);
        test('empresa B registrada + token', !!B.token && !!B.companyId);

        const authA = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${A.token}`
        };
        const authB = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${B.token}`
        };

        // ====================================================
        // TEST 1: crear producto (A)
        // ====================================================
        console.log('\n--- Test 1: crear producto ---');
        const createRes = await request('/api/products/me', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                name: 'Empanada de queso',
                description: 'Empanada frita rellena de queso',
                price: 45.50,
                taxType: 'ITBIS_18',
                itemCode: 'EMP-QUE-001'
            })
        });

        test('POST /api/products/me → 201', createRes.status === 201,
            `got ${createRes.status} ${JSON.stringify(createRes.body)}`);

        const productAId = createRes.body?.data?.product?.id;
        test('respuesta contiene id de producto', !!productAId);
        test('companyId correcto en producto',
            createRes.body?.data?.product?.companyId === A.companyId);

        // ====================================================
        // TEST 2: rechazar ITBIS_3_46 (fuera del POS)
        // ====================================================
        console.log('\n--- Test 2: rechazar ITBIS_3_46 ---');
        const badTaxRes = await request('/api/products/me', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                name: 'Producto con ITBIS3',
                price: 100,
                taxType: 'ITBIS_3_46'
            })
        });
        test('POST con ITBIS_3_46 → 400', badTaxRes.status === 400,
            `got ${badTaxRes.status}`);
        test('error code = VALIDATION_ERROR',
            badTaxRes.body?.error?.code === 'VALIDATION_ERROR');

        // ====================================================
        // TEST 3: itemCode duplicado → 409
        // ====================================================
        console.log('\n--- Test 3: itemCode duplicado ---');
        const dupRes = await request('/api/products/me', {
            method: 'POST',
            headers: authA,
            body: JSON.stringify({
                name: 'Otro producto',
                price: 10,
                taxType: 'ITBIS_18',
                itemCode: 'EMP-QUE-001'
            })
        });
        test('itemCode duplicado → 409', dupRes.status === 409,
            `got ${dupRes.status}`);
        test('error code = DUPLICATE_ITEM_CODE',
            dupRes.body?.error?.code === 'DUPLICATE_ITEM_CODE');

        // ====================================================
        // TEST 4: listar mis productos
        // ====================================================
        console.log('\n--- Test 4: listar ---');
        const listRes = await request('/api/products/me?isActive=true&page=1&limit=10', {
            headers: authA
        });
        test('GET /api/products/me → 200', listRes.status === 200);
        test('devuelve al menos 1 producto',
            Array.isArray(listRes.body?.data?.items) &&
            listRes.body.data.items.length >= 1);
        test('pagination presente',
            !!listRes.body?.data?.pagination);

        // ====================================================
        // TEST 5: buscar por nombre
        // ====================================================
        console.log('\n--- Test 5: buscar ---');
        const searchRes = await request('/api/products/me?search=Empanada', {
            headers: authA
        });
        test('búsqueda por nombre → 200', searchRes.status === 200);
        test('al menos 1 match',
            (searchRes.body?.data?.items || []).length >= 1);

        // ====================================================
        // TEST 6: ver uno
        // ====================================================
        console.log('\n--- Test 6: ver uno ---');
        const getRes = await request(`/api/products/me/${productAId}`, {
            headers: authA
        });
        test('GET /api/products/me/:id → 200', getRes.status === 200);
        test('nombre correcto',
            getRes.body?.data?.product?.name === 'Empanada de queso');

        // ====================================================
        // TEST 7: actualizar
        // ====================================================
        console.log('\n--- Test 7: actualizar ---');
        const updRes = await request(`/api/products/me/${productAId}`, {
            method: 'PATCH',
            headers: authA,
            body: JSON.stringify({
                price: 50.00,
                description: 'Empanada frita rellena de queso (nuevo precio)'
            })
        });
        test('PATCH → 200', updRes.status === 200,
            `got ${updRes.status} ${JSON.stringify(updRes.body)}`);
        test('precio actualizado a 50',
            Number(updRes.body?.data?.product?.price) === 50);

        // ====================================================
        // TEST 8: desactivar
        // ====================================================
        console.log('\n--- Test 8: desactivar ---');
        const deactRes = await request(`/api/products/me/${productAId}/activate`, {
            method: 'PATCH',
            headers: authA,
            body: JSON.stringify({ isActive: false })
        });
        test('PATCH activate → 200', deactRes.status === 200);
        test('isActive = false',
            deactRes.body?.data?.product?.isActive === false);

        // ====================================================
        // TEST 9: no aparece en listado isActive=true
        // ====================================================
        console.log('\n--- Test 9: no aparece en activos ---');
        const activeListRes = await request('/api/products/me?isActive=true', {
            headers: authA
        });
        const idsActive = (activeListRes.body?.data?.items || []).map(p => p.id);
        test('producto desactivado fuera de la lista activa',
            !idsActive.includes(productAId));

        // ====================================================
        // TEST 10: multi-tenant — B no ve el producto de A
        // ====================================================
        console.log('\n--- Test 10: multi-tenant (B no ve producto de A) ---');
        const bGetRes = await request(`/api/products/me/${productAId}`, {
            headers: authB
        });
        test('B GET /:id de producto de A → 404', bGetRes.status === 404,
            `got ${bGetRes.status}`);

        const bListRes = await request('/api/products/me?limit=100', {
            headers: authB
        });
        const bIds = (bListRes.body?.data?.items || []).map(p => p.id);
        test('B no ve el producto de A en su lista',
            !bIds.includes(productAId));

        // B intenta actualizar el producto de A → 404
        const bUpdRes = await request(`/api/products/me/${productAId}`, {
            method: 'PATCH',
            headers: authB,
            body: JSON.stringify({ price: 1 })
        });
        test('B PATCH producto de A → 404', bUpdRes.status === 404,
            `got ${bUpdRes.status}`);

        // B intenta borrar el producto de A → 404
        const bDelRes = await request(`/api/products/me/${productAId}`, {
            method: 'DELETE',
            headers: authB
        });
        test('B DELETE producto de A → 404', bDelRes.status === 404,
            `got ${bDelRes.status}`);

        // ====================================================
        // TEST 11: PRODUCT_HAS_INVOICES
        // Fabricamos una invoice_line con el mismo itemCode del
        // producto A para forzar el 409. No necesitamos una
        // factura completa (schema de invoices es muy estricto);
        // solo lo mínimo para que la query del servicio la
        // encuentre (itemCode + companyId en invoice).
        // ====================================================
        console.log('\n--- Test 11: PRODUCT_HAS_INVOICES ---');
        // 11.a. Reactivar el producto primero (estaba desactivado)
        await request(`/api/products/me/${productAId}/activate`, {
            method: 'PATCH',
            headers: authA,
            body: JSON.stringify({ isActive: true })
        });

        // 11.b. Crear una factura mínima + línea con el mismo itemCode.
        // Usamos el modelo directamente (no el endpoint) para
        // no depender del schema de invoices.
        const companyA = await Company.findByPk(A.companyId);
        const { Sequence } = require('../../src/models');

        // Creamos una secuencia y factura mínima
        const sequence = await Sequence.create({
            companyId: companyA.id,
            type: '32',
            prefix: 'E32',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });

        const fakeInvoice = await Invoice.create({
            companyId: companyA.id,
            sequenceId: sequence.id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: companyA.rnc,
            issuerName: companyA.name,
            subtotal: 45.50,
            itbis: 8.19,
            total: 53.69,
            issuedAt: new Date()
        });

        await InvoiceLine.create({
            invoiceId: fakeInvoice.id,
            lineNumber: 1,
            itemCode: 'EMP-QUE-001',
            description: 'Empanada de queso',
            quantity: 1,
            unitPrice: 45.50,
            discount: 0,
            itbisRate: 18,
            itbisAmount: 8.19,
            indicadorFacturacion: 1,
            total: 53.69
        });

        // 11.c. Intentar borrar el producto → 409 PRODUCT_HAS_INVOICES
        const delWithInvoicesRes = await request(`/api/products/me/${productAId}`, {
            method: 'DELETE',
            headers: authA
        });
        test('DELETE con factura asociada → 409',
            delWithInvoicesRes.status === 409,
            `got ${delWithInvoicesRes.status} ${JSON.stringify(delWithInvoicesRes.body)}`);
        test('error code = PRODUCT_HAS_INVOICES',
            delWithInvoicesRes.body?.error?.code === 'PRODUCT_HAS_INVOICES');

        // 11.d. Limpiar la factura fake
        await InvoiceLine.destroy({ where: { invoiceId: fakeInvoice.id } });
        await Invoice.destroy({ where: { id: fakeInvoice.id } });
        await Sequence.destroy({ where: { id: sequence.id } });

        // ====================================================
        // TEST 12: borrar producto (sin facturas) → 200
        // ====================================================
        console.log('\n--- Test 12: borrar producto limpio ---');
        const delRes = await request(`/api/products/me/${productAId}`, {
            method: 'DELETE',
            headers: authA
        });
        test('DELETE → 200', delRes.status === 200,
            `got ${delRes.status} ${JSON.stringify(delRes.body)}`);

        // Verificar 404 posterior
        const checkRes = await request(`/api/products/me/${productAId}`, {
            headers: authA
        });
        test('producto ya no existe → 404', checkRes.status === 404);

        // ====================================================
        // TEST 13: audit logs generados
        // ====================================================
        console.log('\n--- Test 13: audit logs ---');
        const auditCount = await AuditLog.count({
            where: {
                companyId: A.companyId,
                action: {
                    [Op.in]: [
                        'product.created',
                        'product.updated',
                        'product.activated',
                        'product.deactivated',
                        'product.deleted'
                    ]
                }
            }
        });
        test('audit logs >= 5', auditCount >= 5, `got ${auditCount}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            await cleanup();
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        await sequelize.close();
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();