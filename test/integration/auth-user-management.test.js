require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company, Subscription, AuditLog } = require('../../src/models');

let adminCookie = null;
let companyAdminCookie = null;
let testCompanyId = null;
let testAdminId = null;
let testCompanyAdminId = null;
let testOperatorId = null;

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

        // ============================================================
        // SETUP: crear admin, company, company_admin
        // ============================================================
        await Company.destroy({ where: { rnc: '130999444' } });
        await User.destroy({ where: { email: 'admin-mgmt@expedinap.com' } });
        await User.destroy({ where: { email: 'owner-mgmt@expedinap.com' } });

        const adminUser = await User.create({
            email: 'admin-mgmt@expedinap.com',
            password: 'AdminPass123',
            firstName: 'Admin',
            lastName: 'Mgmt',
            role: 'admin'
        });
        testAdminId = adminUser.id;

        const companyRes = await request('/api/auth/register-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company: { rnc: '130999444', name: 'Mgmt Test Company' },
                owner: {
                    email: 'owner-mgmt@expedinap.com',
                    password: 'OwnerPass123',
                    firstName: 'Owner',
                    lastName: 'Mgmt'
                }
            })
        });
        testCompanyId = companyRes.body?.data?.company?.id;
        testCompanyAdminId = companyRes.body?.data?.user?.id;

        adminCookie = await loginAndGetCookie('admin-mgmt@expedinap.com', 'AdminPass123');
        companyAdminCookie = await loginAndGetCookie('owner-mgmt@expedinap.com', 'OwnerPass123');

        console.log('✅ Setup completed\n');

        // ============================================================
        // ADMIN: GET /users
        // ============================================================
        console.log('--- Test 1: admin GET /users ---');
        const listRes = await request('/api/auth/users', {
            headers: { Cookie: adminCookie }
        });
        test('status 200', listRes.status === 200, `got ${listRes.status}`);
        test('has items array', Array.isArray(listRes.body?.data?.items));
        test('has pagination object', typeof listRes.body?.data?.pagination === 'object');
        test('has totalItems', typeof listRes.body?.data?.pagination?.totalItems === 'number');
        test('has page', listRes.body?.data?.pagination?.page === 1);

        // ============================================================
        // COMPANY_ADMIN: GET /company/users
        // ============================================================
        console.log('\n--- Test 2: company_admin GET /company/users ---');
        const listCompanyRes = await request('/api/auth/company/users', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 200', listCompanyRes.status === 200, `got ${listCompanyRes.status}`);
        test('has items array', Array.isArray(listCompanyRes.body?.data?.items));
        test('only own company users', listCompanyRes.body?.data?.items?.every(
            u => u.companyId === testCompanyId
        ));
        test('has pagination', typeof listCompanyRes.body?.data?.pagination === 'object');

        // ============================================================
        // ADMIN: POST /users — crear operator
        // ============================================================
        console.log('\n--- Test 3: admin POST /users (operator) ---');
        const createOpRes = await request('/api/auth/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                email: 'operator-mgmt@expedinap.com',
                password: 'OperatorPass123',
                firstName: 'Operator',
                lastName: 'Mgmt',
                role: 'operator',
                companyId: testCompanyId
            })
        });
        test('status 201', createOpRes.status === 201, `got ${createOpRes.status}`);
        test('role is operator', createOpRes.body?.data?.user?.role === 'operator');
        testOperatorId = createOpRes.body?.data?.user?.id;

        // ============================================================
        // ADMIN: POST /users con rol inválido (admin con companyId)
        // ============================================================
        console.log('\n--- Test 4: admin POST /users (admin con companyId) ---');
        const badRoleRes = await request('/api/auth/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({
                email: 'bad-admin@expedinap.com',
                password: 'BadPass123A',
                firstName: 'Bad',
                lastName: 'Admin',
                role: 'admin',
                companyId: testCompanyId
            })
        });
        test('status 400', badRoleRes.status === 400, `got ${badRoleRes.status}`);
        test('code INVALID_ROLE_COMPANY', badRoleRes.body?.error?.code === 'INVALID_ROLE_COMPANY');

        // ============================================================
        // COMPANY_ADMIN: POST /company/users — crear operator
        // ============================================================
        console.log('\n--- Test 5: company_admin POST /company/users ---');
        const createByCompanyRes = await request('/api/auth/company/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({
                email: 'operator2-mgmt@expedinap.com',
                password: 'Operator2Pass123',
                firstName: 'Operator2',
                lastName: 'Mgmt'
            })
        });
        test('status 201', createByCompanyRes.status === 201, `got ${createByCompanyRes.status}`);
        test('role is operator', createByCompanyRes.body?.data?.user?.role === 'operator');
        test('companyId is own', createByCompanyRes.body?.data?.user?.companyId === testCompanyId);

        // ============================================================
        // COMPANY_ADMIN: PATCH /company/users/:id — editar
        // ============================================================
        console.log('\n--- Test 6: company_admin PATCH /company/users/:id ---');
        const updateRes = await request(`/api/auth/company/users/${testOperatorId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ firstName: 'UpdatedOperator' })
        });
        test('status 200', updateRes.status === 200, `got ${updateRes.status}`);
        test('firstName updated', updateRes.body?.data?.user?.firstName === 'UpdatedOperator');

        // ============================================================
        // COMPANY_ADMIN intenta editar usuario de OTRA empresa
        // ============================================================
        console.log('\n--- Test 7: company_admin edita usuario de otra empresa ---');
        const foreignUser = await User.create({
            email: 'foreign@expedinap.com',
            password: 'ForeignPass123',
            firstName: 'Foreign',
            lastName: 'User',
            role: 'operator',
            companyId: testCompanyId
        });
        const otherCompany = await Company.create({ rnc: '130999555', name: 'Other Company' });
        const foreignUser2 = await User.create({
            email: 'foreign2@expedinap.com',
            password: 'ForeignPass123',
            firstName: 'Foreign2',
            lastName: 'User',
            role: 'operator',
            companyId: otherCompany.id
        });

        const foreignUpdateRes = await request(`/api/auth/company/users/${foreignUser2.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': companyAdminCookie
            },
            body: JSON.stringify({ firstName: 'Hacked' })
        });
        test('status 403', foreignUpdateRes.status === 403, `got ${foreignUpdateRes.status}`);

        await foreignUser.destroy();
        await foreignUser2.destroy();
        await otherCompany.destroy();

        // ============================================================
        // COMPANY_ADMIN: DELETE /company/users/:id — desactivar
        // ============================================================
        console.log('\n--- Test 8: company_admin DELETE /company/users/:id ---');
        const deleteRes = await request(`/api/auth/company/users/${testOperatorId}`, {
            method: 'DELETE',
            headers: { 'Cookie': companyAdminCookie }
        });
        test('status 200', deleteRes.status === 200, `got ${deleteRes.status}`);
        test('deactivated, not deleted', deleteRes.body?.data?.deactivated === true);

        const stillExists = await User.findByPk(testOperatorId);
        test('user still exists', !!stillExists);
        test('user is inactive', stillExists?.isActive === false);

        // ============================================================
        // COMPANY_ADMIN intenta borrarse a sí mismo
        // ============================================================
        console.log('\n--- Test 9: company_admin intenta borrarse a sí mismo ---');
        const selfDeleteRes = await request(`/api/auth/company/users/${testCompanyAdminId}`, {
            method: 'DELETE',
            headers: { Cookie: companyAdminCookie }
        });
        test('status 400', selfDeleteRes.status === 400, `got ${selfDeleteRes.status}`);
        test('code CANNOT_DELETE_SELF', selfDeleteRes.body?.error?.code === 'CANNOT_DELETE_SELF');

        // ============================================================
        // COMPANY_ADMIN intenta acceder a /users (solo admin)
        // ============================================================
        console.log('\n--- Test 10: company_admin GET /users (debe fallar) ---');
        const forbiddenRes = await request('/api/auth/users', {
            headers: { Cookie: companyAdminCookie }
        });
        test('status 403', forbiddenRes.status === 403, `got ${forbiddenRes.status}`);
        test('code INSUFFICIENT_ROLE', forbiddenRes.body?.error?.code === 'INSUFFICIENT_ROLE');

        // ============================================================
        // ADMIN: PATCH /users/:id/activate
        // ============================================================
        console.log('\n--- Test 11: admin PATCH /users/:id/activate ---');
        const activateRes = await request(`/api/auth/users/${testOperatorId}/activate`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            },
            body: JSON.stringify({ isActive: true })
        });
        test('status 200', activateRes.status === 200, `got ${activateRes.status}`);
        test('isActive is true', activateRes.body?.data?.user?.isActive === true);

        // ============================================================
        // ADMIN: DELETE /users/:id (hard delete)
        // ============================================================
        console.log('\n--- Test 12: admin DELETE /users/:id ---');
        const hardDeleteRes = await request(`/api/auth/users/${testOperatorId}`, {
            method: 'DELETE',
            headers: { Cookie: adminCookie }
        });
        test('status 200', hardDeleteRes.status === 200, `got ${hardDeleteRes.status}`);
        test('deleted true', hardDeleteRes.body?.data?.deleted === true);

        const reallyGone = await User.findByPk(testOperatorId);
        test('user no longer exists', !reallyGone);

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (testCompanyId) {
                const users = await User.findAll({ where: { companyId: testCompanyId } });
                for (const u of users) {
                    await AuditLog.destroy({ where: { userId: u.id } });
                }
                await AuditLog.destroy({ where: { companyId: testCompanyId } });
                await Subscription.destroy({ where: { companyId: testCompanyId } });
                await User.destroy({ where: { companyId: testCompanyId } });
                await Company.destroy({ where: { id: testCompanyId } });
            }
            if (testAdminId) {
                await AuditLog.destroy({ where: { userId: testAdminId } });
                await User.destroy({ where: { id: testAdminId } });
            }
            await User.destroy({ where: { email: { [require('sequelize').Op.like]: '%mgmt@expedinap.com' } } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();