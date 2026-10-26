require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence } = require('../../src/models');

// ============================================================
// Datos de test (fixtures)
// ============================================================
let testRnc = '130999904';
let testEmail = 'owner-stats@expedinap.com';
let operatorEmail = 'operator-stats@expedinap.com';
let testCompanyId = null;

// Usuarios reales del .env (no se crean ni se borran)
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const realCompanyAdminEmail = process.env.TEST_COMPANY_ADMIN_EMAIL;
const realCompanyAdminPassword = process.env.TEST_COMPANY_ADMIN_PASSWORD;

// Cookies
let companyAdminCookie = null;   // usuario de test (empresa de test)
let operatorCookie = null;       // usuario de test (empresa de test)
let realAdminCookie = null;      // admin global real (del .env)
let realCompanyAdminCookie = null; // company_admin real (del .env)

// ============================================================
// Helpers
// ============================================================
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

// ============================================================
// Main
// ============================================================
(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // ----------------------------------------------------
        // Validar que las env vars existan
        // ----------------------------------------------------
        if (!adminEmail || !adminPassword) {
            throw new Error('Missing TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in .env');
        }
        if (!realCompanyAdminEmail || !realCompanyAdminPassword) {
            throw new Error('Missing TEST_COMPANY_ADMIN_EMAIL / TEST_COMPANY_ADMIN_PASSWORD in .env');
        }

        // ----------------------------------------------------
        // Limpieza previa (empresa de test)
        // ----------------------------------------------------
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: [testEmail, operatorEmail] } });

        // ----------------------------------------------------
        // Crear empresa de test + owner + operator
        // ----------------------------------------------------
        const registerRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: testRnc, name: 'Stats Test SRL' },
                owner: {
                    email: testEmail,
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Stats'
                }
            })
        });
        testCompanyId = registerRes.body?.data?.company?.id;
        test('company created', !!testCompanyId);

        await User.create({
            companyId: testCompanyId,
            email: operatorEmail,
            password: 'OperatorPass123',
            firstName: 'Op',
            lastName: 'Stats',
            role: 'operator'
        });

        // ----------------------------------------------------
        // Login de los 4 usuarios
        // ----------------------------------------------------
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        operatorCookie = await loginAndGetCookie(operatorEmail, 'OperatorPass123');
        realAdminCookie = await loginAndGetCookie(adminEmail, adminPassword);
        realCompanyAdminCookie = await loginAndGetCookie(realCompanyAdminEmail, realCompanyAdminPassword);

        test('company_admin cookie ok', !!companyAdminCookie);
        test('operator cookie ok', !!operatorCookie);
        test('real admin cookie ok', !!realAdminCookie);
        test('real company_admin cookie ok', !!realCompanyAdminCookie);

        // ============================================================
        // TEST 1: ping del módulo
        // ============================================================
        console.log('\n--- Test 1: GET /api/stats/ping ---');
        const pingRes = await request('/api/stats/ping');
        test('status 200', pingRes.status === 200, `got ${pingRes.status}`);
        test('module is stats', pingRes.body?.module === 'stats');

        // ============================================================
        // TEST 2: sin auth → 401 en /company
        // ============================================================
        console.log('\n--- Test 2: sin auth → /company → 401 ---');
        const noAuthRes = await request('/api/stats/company');
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // TEST 3: operator NO puede acceder a /company
        // ============================================================
        console.log('\n--- Test 3: operator → /company → 403 ---');
        const opRes = await request('/api/stats/company', {
            headers: { Cookie: operatorCookie }
        });
        test('status 403', opRes.status === 403, `got ${opRes.status}`);
        test('code INSUFFICIENT_ROLE', opRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 4: company_admin SÍ accede a /company
        // ============================================================
        console.log('\n--- Test 4: company_admin → /company → 200 ---');
        const okRes = await request('/api/stats/company', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', okRes.status === 200, `got ${okRes.status}`);
        test('has kpis', !!okRes.body?.data?.kpis);
        test('invoicesThisMonth = 0', okRes.body?.data?.kpis?.invoicesThisMonth === 0);
        test('billedThisMonth = 0', okRes.body?.data?.kpis?.billedThisMonth === 0);
        test('itbisThisMonth = 0', okRes.body?.data?.kpis?.itbisThisMonth === 0);
        test('activeProducts = 0', okRes.body?.data?.kpis?.activeProducts === 0);
        test('salesSeries length = 7', okRes.body?.data?.salesSeries?.length === 7);
        test('topProducts empty', Array.isArray(okRes.body?.data?.topProducts) && okRes.body.data.topProducts.length === 0);
        test('recentInvoices empty', Array.isArray(okRes.body?.data?.recentInvoices) && okRes.body.data.recentInvoices.length === 0);
        test('has alerts array', Array.isArray(okRes.body?.data?.alerts));

        // ============================================================
        // TEST 5: company_admin SÍ puede ver /operator (jerarquía)
        // ============================================================
        console.log('\n--- Test 5: company_admin → /operator → 200 ---');
        const adminOpRes = await request('/api/stats/operator', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', adminOpRes.status === 200, `got ${adminOpRes.status}`);
        test('has kpis', !!adminOpRes.body?.data?.kpis);
        test('invoicesToday = 0', adminOpRes.body?.data?.kpis?.invoicesToday === 0);
        test('billedToday = 0', adminOpRes.body?.data?.kpis?.billedToday === 0);
        test('activeProducts = 0', adminOpRes.body?.data?.kpis?.activeProducts === 0);
        test('lastInvoice = null', adminOpRes.body?.data?.lastInvoice === null);
        test('recentInvoices empty', Array.isArray(adminOpRes.body?.data?.recentInvoices) && adminOpRes.body.data.recentInvoices.length === 0);
        test('stockAlerts empty', Array.isArray(adminOpRes.body?.data?.stockAlerts) && adminOpRes.body.data.stockAlerts.length === 0);

        // ============================================================
        // TEST 6: operator SÍ accede a /operator
        // ============================================================
        console.log('\n--- Test 6: operator → /operator → 200 ---');
        const opOkRes = await request('/api/stats/operator', {
            headers: { Cookie: operatorCookie }
        });
        test('status 200', opOkRes.status === 200, `got ${opOkRes.status}`);
        test('has kpis', !!opOkRes.body?.data?.kpis);
        test('invoicesToday = 0', opOkRes.body?.data?.kpis?.invoicesToday === 0);
        test('has lastInvoice field', opOkRes.body?.data?.lastInvoice === null);
        test('has recentInvoices array', Array.isArray(opOkRes.body?.data?.recentInvoices));
        test('has stockAlerts array', Array.isArray(opOkRes.body?.data?.stockAlerts));

        // ============================================================
        // TEST 7: sin auth → 401 en /operator
        // ============================================================
        console.log('\n--- Test 7: sin auth → /operator → 401 ---');
        const noAuthOpRes = await request('/api/stats/operator');
        test('status 401', noAuthOpRes.status === 401, `got ${noAuthOpRes.status}`);

        // ============================================================
        // TEST 8: company_admin NO puede ver /admin
        // ============================================================
        console.log('\n--- Test 8: company_admin → /admin → 403 ---');
        const cAdminRes = await request('/api/stats/admin', {
            headers: { Cookie: realCompanyAdminCookie }
        });
        test('status 403', cAdminRes.status === 403, `got ${cAdminRes.status}`);
        test('code INSUFFICIENT_ROLE', cAdminRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 9: sin auth → 401 en /admin
        // ============================================================
        console.log('\n--- Test 9: sin auth → /admin → 401 ---');
        const noAuthAdminRes = await request('/api/stats/admin');
        test('status 401', noAuthAdminRes.status === 401, `got ${noAuthAdminRes.status}`);

        // ============================================================
        // TEST 10: admin global SÍ accede a /admin
        // ============================================================
        console.log('\n--- Test 10: admin → /admin → 200 ---');
        const adminOkRes = await request('/api/stats/admin', {
            headers: { Cookie: realAdminCookie }
        });
        test('status 200', adminOkRes.status === 200, `got ${adminOkRes.status}`);
        test('has kpis', !!adminOkRes.body?.data?.kpis);
        test('activeCompanies >= 1', adminOkRes.body?.data?.kpis?.activeCompanies >= 1,
            `got ${adminOkRes.body?.data?.kpis?.activeCompanies}`);
        test('mrr is number', typeof adminOkRes.body?.data?.kpis?.mrr === 'number',
            `got ${typeof adminOkRes.body?.data?.kpis?.mrr}`);
        test('subscriptionsByStatus object', !!adminOkRes.body?.data?.kpis?.subscriptionsByStatus);
        test('subscriptionsByStatus has trial field',
            adminOkRes.body?.data?.kpis?.subscriptionsByStatus?.trial !== undefined);
        test('totalInvoicesThisMonth is number',
            typeof adminOkRes.body?.data?.kpis?.totalInvoicesThisMonth === 'number');
        test('mrrSeries length = 6', adminOkRes.body?.data?.mrrSeries?.length === 6,
            `got ${adminOkRes.body?.data?.mrrSeries?.length}`);
        test('topCompanies array', Array.isArray(adminOkRes.body?.data?.topCompanies));
        test('subscriptionsExpiring array', Array.isArray(adminOkRes.body?.data?.subscriptionsExpiring));
        test('criticalAlerts array', Array.isArray(adminOkRes.body?.data?.criticalAlerts));
        test('recentJobs array', Array.isArray(adminOkRes.body?.data?.recentJobs));

        // ============================================================
        // Resumen
        // ============================================================
        console.log('\n🧹 Cleaned up');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            // Limpieza SOLO de la empresa de test (NO tocamos usuarios reales)
            if (testCompanyId) {
                await Subscription.destroy({ where: { companyId: testCompanyId } });
                await Sequence.destroy({ where: { companyId: testCompanyId } });
                await User.destroy({ where: { companyId: testCompanyId } });
                await Company.destroy({ where: { id: testCompanyId } });
            }
            await User.destroy({ where: { email: [testEmail, operatorEmail] } });
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }
        process.exit(0);
    }
})();