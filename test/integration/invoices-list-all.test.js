require('dotenv').config();
const { request } = require('../helpers/http.helper');
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Invoice, InvoiceLine, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testRnc1 = '130999940';
let testRnc2 = '130999941';
let owner1Email = 'owner1-inv-all@expedinap.com';
let owner2Email = 'owner2-inv-all@expedinap.com';
let adminEmail = 'admin-inv-all@expedinap.com';
let company1Id = null;
let company2Id = null;
let seq1Id = null;
let seq2Id = null;
let inv1Id = null;
let inv2Id = null;
let inv3Id = null;
let adminId = null;

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

        await cleanupCompany(testRnc1);
        await cleanupCompany(testRnc2);
        await User.destroy({ where: { email: [owner1Email, owner2Email, adminEmail] } });

        const adminUser = await User.create({
            email: adminEmail,
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'InvAll',
            role: 'admin'
        });
        adminId = adminUser.id;

        // Crear empresa 1
        const res1 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc1, name: 'Alpha Invoices SRL' },
                owner: { email: owner1Email, password: 'OwnerPass123', firstName: 'Owner1', lastName: 'InvAll' }
            })
        });
        company1Id = res1.body?.data?.company?.id;

        // Crear empresa 2
        const res2 = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc2, name: 'Beta Searchable SRL' },
                owner: { email: owner2Email, password: 'OwnerPass123', firstName: 'Owner2', lastName: 'InvAll' }
            })
        });
        company2Id = res2.body?.data?.company?.id;

        // Secuencias
        const seq1 = await Sequence.create({
            companyId: company1Id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        seq1Id = seq1.id;

        const seq2 = await Sequence.create({
            companyId: company2Id,
            type: '31',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            isActive: true
        });
        seq2Id = seq2.id;

        // Crear facturas
        const now = new Date();
        const inv1 = await Invoice.create({
            companyId: company1Id,
            sequenceId: seq1Id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: testRnc1,
            issuerName: 'Alpha Invoices SRL',
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: now
        });
        inv1Id = inv1.id;

        const inv2 = await Invoice.create({
            companyId: company1Id,
            sequenceId: seq1Id,
            type: '32',
            ncf: 'E320000000002',
            status: 'sent',
            trackId: 'TRACK001',
            issuerRnc: testRnc1,
            issuerName: 'Alpha Invoices SRL',
            receiverRnc: '130999888',
            subtotal: 200,
            itbis: 36,
            total: 236,
            issuedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        });
        inv2Id = inv2.id;

        const inv3 = await Invoice.create({
            companyId: company2Id,
            sequenceId: seq2Id,
            type: '31',
            ncf: 'E310000000001',
            status: 'accepted',
            trackId: 'TRACK002',
            issuerRnc: testRnc2,
            issuerName: 'Beta Searchable SRL',
            subtotal: 300,
            itbis: 54,
            total: 354,
            issuedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        });
        inv3Id = inv3.id;

        // Líneas para inv1
        await InvoiceLine.bulkCreate([
            { invoiceId: inv1Id, lineNumber: 1, description: 'Item 1', quantity: 1, unitPrice: 100, itbisRate: 18, itbisAmount: 18, total: 118 }
        ]);

        // Login
        adminCookie = await loginAndGetCookie(adminEmail, 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie(owner1Email, 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: admin lista todas sin filtros
        // ============================================================
        console.log('--- Test 1: admin lista todas ---');
        const listRes = await request('/api/invoices', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('totalItems >= 3', listRes.body?.data?.pagination?.totalItems >= 3);
        test('has pagination', typeof listRes.body?.data?.pagination === 'object');

        const items = listRes.body?.data?.items || [];
        const ids = items.map(i => i.id);
        test('includes inv1', ids.includes(inv1Id));
        test('includes inv2', ids.includes(inv2Id));
        test('includes inv3', ids.includes(inv3Id));

        // Verificar que incluye company
        const inv1Item = items.find(i => i.id === inv1Id);
        test('inv1 has company include', !!inv1Item?.company);
        test('inv1 company.rnc is testRnc1', inv1Item?.company?.rnc === testRnc1);
        test('inv1 company.name is Alpha', inv1Item?.company?.name === 'Alpha Invoices SRL');
        test('inv1 has lineCount', inv1Item?.lineCount === 1);
        test('inv1 has sequence include', !!inv1Item?.sequence);

        // ============================================================
        // TEST 2: filtro por companyId
        // ============================================================
        console.log('\n--- Test 2: filtro companyId ---');
        const companyFilterRes = await request(`/api/invoices?companyId=${company1Id}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', companyFilterRes.status === 200);
        test('all items belong to company1', companyFilterRes.body?.data?.items?.every(i => i.companyId === company1Id));
        test('does NOT include inv3', !companyFilterRes.body?.data?.items?.some(i => i.id === inv3Id));

        // ============================================================
        // TEST 3: filtro por status
        // ============================================================
        console.log('\n--- Test 3: filtro status ---');
        const draftRes = await request('/api/invoices?status=draft', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', draftRes.status === 200);
        test('all draft', draftRes.body?.data?.items?.every(i => i.status === 'draft'));

        // ============================================================
        // TEST 4: filtro por type
        // ============================================================
        console.log('\n--- Test 4: filtro type ---');
        const type31Res = await request('/api/invoices?type=31', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', type31Res.status === 200);
        test('all type 31', type31Res.body?.data?.items?.every(i => i.type === '31'));

        // ============================================================
        // TEST 5: filtro hasTrackId
        // ============================================================
        console.log('\n--- Test 5: filtro hasTrackId ---');
        const trackRes = await request('/api/invoices?hasTrackId=true', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', trackRes.status === 200);
        test('all have trackId', trackRes.body?.data?.items?.every(i => i.trackId));

        // ============================================================
        // TEST 6: filtro search por RNC de empresa
        // ============================================================
        console.log('\n--- Test 6: filtro search por RNC ---');
        const searchRes = await request(`/api/invoices?search=${testRnc1}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchRes.status === 200);
        test('all belong to company1', searchRes.body?.data?.items?.every(i => i.companyId === company1Id));

        // ============================================================
        // TEST 7: filtro search por nombre de empresa
        // ============================================================
        console.log('\n--- Test 7: filtro search por nombre ---');
        const searchNameRes = await request('/api/invoices?search=Searchable', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', searchNameRes.status === 200);
        test('all belong to company2', searchNameRes.body?.data?.items?.every(i => i.companyId === company2Id));

        // ============================================================
        // TEST 8: filtro fromDate
        // ============================================================
        console.log('\n--- Test 8: filtro fromDate ---');
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const fromDateRes = await request(`/api/invoices?fromDate=${twoDaysAgo}`, {
            headers: { Cookie: adminCookie }
        });
        test('status 200', fromDateRes.status === 200);
        test('excludes 7-day-old inv3', !fromDateRes.body?.data?.items?.some(i => i.id === inv3Id));

        // ============================================================
        // TEST 9: paginación
        // ============================================================
        console.log('\n--- Test 9: paginación ---');
        const pagRes = await request('/api/invoices?limit=1&page=1', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', pagRes.status === 200);
        test('returns 1 item', pagRes.body?.data?.items?.length === 1);
        test('hasNextPage true', pagRes.body?.data?.pagination?.hasNextPage === true);

        // ============================================================
        // TEST 10: company_admin NO puede usar esta ruta
        // ============================================================
        console.log('\n--- Test 10: company_admin intenta ---');
        const forbiddenRes = await request('/api/invoices', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 11: sin autenticación → 401
        // ============================================================
        console.log('\n--- Test 11: sin autenticación ---');
        const noAuthRes = await request('/api/invoices');
        test('status 401', noAuthRes.status === 401);

        // ============================================================
        // TEST 12: NO expone xmlContent/xmlSigned en listado
        // ============================================================
        console.log('\n--- Test 12: NO expone XML ---');
        test('inv1 does NOT expose xmlContent', inv1Item?.xmlContent === undefined);
        test('inv1 does NOT expose xmlSigned', inv1Item?.xmlSigned === undefined);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            await cleanupCompany(testRnc1);
            await cleanupCompany(testRnc2);
            if (adminId) {
                await AuditLog.destroy({ where: { userId: adminId } });
                await User.destroy({ where: { id: adminId } });
            }
            await User.destroy({ where: { email: [owner1Email, owner2Email, adminEmail] } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();