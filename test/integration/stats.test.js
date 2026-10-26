require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, Sequence, Plan } = require('../../src/models');

let companyAdminCookie = null;
let operatorCookie = null;
let testRnc = '130999904';
let testEmail = 'owner-stats@expedinap.com';
let operatorEmail = 'operator-stats@expedinap.com';
let testCompanyId = null;

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

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        const oldCompany = await Company.findOne({ where: { rnc: testRnc } });
        if (oldCompany) {
            await Subscription.destroy({ where: { companyId: oldCompany.id } });
            await Sequence.destroy({ where: { companyId: oldCompany.id } });
            await User.destroy({ where: { companyId: oldCompany.id } });
            await Company.destroy({ where: { id: oldCompany.id } });
        }
        await User.destroy({ where: { email: [testEmail, operatorEmail] } });

        // Crear empresa + owner vía register-company
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

        // Crear operator (asumiendo que existe un endpoint /api/users)
        // Si no, se crea directo en BD:
        await User.create({
            companyId: testCompanyId,
            email: operatorEmail,
            password: 'OperatorPass123',
            firstName: 'Op',
            lastName: 'Stats',
            role: 'operator'
        });

        // Login
        companyAdminCookie = await loginAndGetCookie(testEmail, 'OwnerPass123');
        operatorCookie = await loginAndGetCookie(operatorEmail, 'OperatorPass123');

        // ============================================================
        // TEST 1: ping del módulo
        // ============================================================
        console.log('--- Test 1: GET /api/stats/ping ---');
        const pingRes = await request('/api/stats/ping');
        test('status 200', pingRes.status === 200, `got ${pingRes.status}`);
        test('module is stats', pingRes.body?.module === 'stats');

        // ============================================================
        // TEST 2: sin auth → 401
        // ============================================================
        console.log('\n--- Test 2: sin auth → 401 ---');
        const noAuthRes = await request('/api/stats/company');
        test('status 401', noAuthRes.status === 401, `got ${noAuthRes.status}`);

        // ============================================================
        // TEST 3: operator NO puede acceder al dashboard de company
        // ============================================================
        console.log('\n--- Test 3: operator → 403 ---');
        const opRes = await request('/api/stats/company', {
            headers: { Cookie: operatorCookie }
        });
        test('status 403', opRes.status === 403, `got ${opRes.status}`);
        test('code INSUFFICIENT_ROLE', opRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // TEST 4: company_admin SÍ accede
        // ============================================================
        console.log('\n--- Test 4: company_admin → 200 ---');
        const okRes = await request('/api/stats/company', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', okRes.status === 200, `got ${okRes.status}`);
        test('has kpis', !!okRes.body?.data?.kpis);
        test('invoicesThisMonth = 0', okRes.body?.data?.kpis?.invoicesThisMonth === 0);
        test('billedThisMonth = 0', okRes.body?.data?.kpis?.billedThisMonth === 0);
        test('activeProducts = 0', okRes.body?.data?.kpis?.activeProducts === 0);
        test('salesSeries length = 7', okRes.body?.data?.salesSeries?.length === 7);
        test('recentInvoices empty', Array.isArray(okRes.body?.data?.recentInvoices) && okRes.body.data.recentInvoices.length === 0);
        test('has alerts array', Array.isArray(okRes.body?.data?.alerts));

        // Limpieza
        console.log('\n🧹 Cleaned up');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
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