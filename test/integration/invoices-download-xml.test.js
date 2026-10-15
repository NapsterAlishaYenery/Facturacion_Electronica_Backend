// test/integration/invoices-download-xml.test.js
//
// Verifica el endpoint GET /api/invoices/me/:id/xml?type=unsigned|signed
//
// Endpoint devuelve XML (no JSON). El helper maneja ambos casos.

require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const {
    User,
    Company,
    Subscription,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../src/models');

// ------------------------------------------------------------
// RNCs únicos por ejecución (evita colisiones)
// ------------------------------------------------------------
const uniqueSuffix = String(Date.now()).slice(-5);
const testRnc = `13099${uniqueSuffix}0`;
const otherRnc = `13099${uniqueSuffix}1`;
const testEmail = 'owner-inv-xml@expedinap.com';
const otherEmail = 'other-xml@expedinap.com';
const otherEmailCleanup = 'other-xml-cleanup@expedinap.com';

let companyAdminCookie = null;
let testCompanyId = null;
let otherCompanyId = null;

// IDs de facturas
let invoiceUnsignedId = null;
let invoiceSignedId = null;
let invoiceNoXmlId = null;
let invoiceOtherCompanyId = null;

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

// ------------------------------------------------------------
// Helper: crea factura draft con xmlContent/xmlSigned
// ------------------------------------------------------------
async function createInvoiceWithXML(companyId, overrides = {}) {
    const seq = await Sequence.create({
        companyId,
        type: '32',
        prefix: 'E',
        startNumber: 1,
        endNumber: 9999,
        currentNumber: 0,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true
    });

    const ncf = `E32${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 100)}`.slice(0, 13);

    const invoice = await Invoice.create({
        companyId,
        sequenceId: seq.id,
        type: '32',
        ncf,
        status: 'draft',
        issuerRnc: '02800918407',
        issuerName: 'ExpediNap',
        receiverRnc: '13006904627',
        receiverName: 'Cliente Test SRL',
        subtotal: 1000,
        itbis: 180,
        total: 1180,
        issuedAt: new Date(),
        xmlContent: overrides.xmlContent !== undefined
            ? overrides.xmlContent
            : '<?xml version="1.0" encoding="UTF-8"?><ECF>test</ECF>',
        xmlSigned: overrides.xmlSigned !== undefined
            ? overrides.xmlSigned
            : null
    });

    return invoice;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ------------------------------------------------------------
        // Limpieza previa (por RNC único, improbable, pero por si acaso)
        // ------------------------------------------------------------
        for (const rnc of [testRnc, otherRnc]) {
            const old = await Company.findOne({ where: { rnc } });
            if (old) {
                const { Op } = require('sequelize');
                await AuditLog.destroy({ where: { companyId: old.id } });
                const invs = await Invoice.findAll({ where: { companyId: old.id }, attributes: ['id'] });
                const ids = invs.map(i => i.id);
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
        await User.destroy({ where: { email: [testEmail, otherEmail] } });

        // ------------------------------------------------------------
        // Setup empresa 1 (principal)
        // ------------------------------------------------------------
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'XML Download Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'XML'
                }
            })
        });

        if (registerRes.status !== 201 || !registerRes.body?.data?.company?.id) {
            console.error('❌ Failed to register main company:');
            console.error('   Status:', registerRes.status);
            console.error('   Body:', JSON.stringify(registerRes.body, null, 2));
            throw new Error('Cannot continue without testCompanyId');
        }
        testCompanyId = registerRes.body.data.company.id;

        // ------------------------------------------------------------
        // Setup empresa 2 (otra empresa, para test multi-tenant)
        // ------------------------------------------------------------
        const otherRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: otherRnc, name: 'Other XML Company SRL' },
                owner: {
                    email: otherEmail,
                    password: 'OwnerPass123',
                    firstName: 'Other',
                    lastName: 'XML'
                }
            })
        });

        if (otherRes.status !== 201 || !otherRes.body?.data?.company?.id) {
            console.error('❌ Failed to register other company:');
            console.error('   Status:', otherRes.status);
            console.error('   Body:', JSON.stringify(otherRes.body, null, 2));
            throw new Error('Cannot continue without otherCompanyId');
        }
        otherCompanyId = otherRes.body.data.company.id;

        // ------------------------------------------------------------
        // Login empresa 1
        // ------------------------------------------------------------
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        if (!companyAdminCookie) {
            throw new Error('Failed to login main company admin');
        }

        console.log('✅ Setup completed\n');

        // ------------------------------------------------------------
        // Crear facturas de prueba
        // ------------------------------------------------------------

        // 1. Factura con XML unsigned
        const invoiceUnsigned = await createInvoiceWithXML(testCompanyId, {
            xmlContent: '<?xml version="1.0" encoding="UTF-8"?><ECF><IdDoc><TipoeCF>32</TipoeCF></IdDoc></ECF>'
        });
        invoiceUnsignedId = invoiceUnsigned.id;

        // 2. Factura con XML unsigned + signed
        const invoiceSigned = await createInvoiceWithXML(testCompanyId, {
            xmlContent: '<?xml version="1.0" encoding="UTF-8"?><ECF>unsigned</ECF>',
            xmlSigned: '<?xml version="1.0" encoding="UTF-8"?><ECF><Signature>signed-content</Signature></ECF>'
        });
        invoiceSignedId = invoiceSigned.id;

        // 3. Factura sin XML
        const invoiceNoXml = await createInvoiceWithXML(testCompanyId, {
            xmlContent: null,
            xmlSigned: null
        });
        invoiceNoXmlId = invoiceNoXml.id;

        // 4. Factura de OTRA empresa (para multi-tenant)
        const invoiceOtherCompany = await createInvoiceWithXML(otherCompanyId, {
            xmlContent: '<?xml version="1.0" encoding="UTF-8"?><ECF>other-company</ECF>'
        });
        invoiceOtherCompanyId = invoiceOtherCompany.id;

        // ============================================================
        // TEST 1: descarga unsigned exitosa
        // ============================================================
        console.log('--- Test 1: descarga unsigned ---');
        const res1 = await request(`/api/invoices/me/${invoiceUnsignedId}/xml`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', res1.status === 200, `got ${res1.status}`);
        test('Content-Type xml', res1.headers['content-type']?.includes('xml'));
        test('Content-Disposition attachment', res1.headers['content-disposition']?.includes('attachment'));
        test('Content-Disposition has .xml', res1.headers['content-disposition']?.includes('.xml'));
        test('body contiene ECF', typeof res1.body === 'string' && res1.body.includes('<ECF>'));

        // ============================================================
        // TEST 2: default es unsigned (sin query param)
        // ============================================================
        console.log('\n--- Test 2: default es unsigned ---');
        const res2 = await request(`/api/invoices/me/${invoiceUnsignedId}/xml`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', res2.status === 200);

        // ============================================================
        // TEST 3: type=unsigned explícito
        // ============================================================
        console.log('\n--- Test 3: type=unsigned explícito ---');
        const res3 = await request(`/api/invoices/me/${invoiceUnsignedId}/xml?type=unsigned`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', res3.status === 200);

        // ============================================================
        // TEST 4: factura sin XML → 409 XML_NOT_GENERATED
        // ============================================================
        console.log('\n--- Test 4: factura sin XML → 409 ---');
        const res4 = await request(`/api/invoices/me/${invoiceNoXmlId}/xml?type=unsigned`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 409', res4.status === 409, `got ${res4.status}`);
        test('code XML_NOT_GENERATED', res4.body?.error?.code === 'XML_NOT_GENERATED');

        // ============================================================
        // TEST 5: type inválido → 400
        // ============================================================
        console.log('\n--- Test 5: type inválido → 400 ---');
        const res5 = await request(`/api/invoices/me/${invoiceUnsignedId}/xml?type=foo`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', res5.status === 400, `got ${res5.status}`);

        // ============================================================
        // TEST 6: ID inexistente → 404
        // ============================================================
        console.log('\n--- Test 6: ID inexistente → 404 ---');
        const res6 = await request('/api/invoices/me/00000000-0000-0000-0000-000000000000/xml', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', res6.status === 404);
        test('code INVOICE_NOT_FOUND', res6.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 7: ID malformado → 400
        // ============================================================
        console.log('\n--- Test 7: ID malformado → 400 ---');
        const res7 = await request('/api/invoices/me/not-a-uuid/xml', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', res7.status === 400);

        // ============================================================
        // TEST 8: factura de OTRA empresa → 404 (multi-tenant)
        // ============================================================
        console.log('\n--- Test 8: factura de otra empresa → 404 ---');
        const res8 = await request(`/api/invoices/me/${invoiceOtherCompanyId}/xml`, {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 404', res8.status === 404, `got ${res8.status}`);
        test('code INVOICE_NOT_FOUND', res8.body?.error?.code === 'INVOICE_NOT_FOUND');

        // ============================================================
        // TEST 9: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 9: sin autenticación → 401 ---');
        const res9 = await request(`/api/invoices/me/${invoiceUnsignedId}/xml`);
        test('status 401', res9.status === 401);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        // ------------------------------------------------------------
        // Limpieza
        // ------------------------------------------------------------
        try {
            const { Op } = require('sequelize');

            for (const cid of [testCompanyId, otherCompanyId]) {
                if (cid) {
                    await AuditLog.destroy({ where: { companyId: cid } });
                    const invs = await Invoice.findAll({ where: { companyId: cid }, attributes: ['id'] });
                    const ids = invs.map(i => i.id);
                    if (ids.length > 0) {
                        await InvoiceLine.destroy({ where: { invoiceId: { [Op.in]: ids } } });
                    }
                    await Invoice.destroy({ where: { companyId: cid } });
                    await Sequence.destroy({ where: { companyId: cid } });
                    await Subscription.destroy({ where: { companyId: cid } });
                    await User.destroy({ where: { companyId: cid } });
                    await Company.destroy({ where: { id: cid } });
                }
            }

            await User.destroy({ where: { email: [testEmail, otherEmail, otherEmailCleanup] } });

            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();