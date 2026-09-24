require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User } = require('../../src/models');
const { signAccessToken } = require('../../src/shared/utils/jwt');

// Rutas de prueba (las agregamos al server temporalmente)
const ROUTES = {
    operatorLevel: '/api/auth/test/operator',
    companyLevel: '/api/auth/test/company',
    adminLevel: '/api/auth/test/admin'
};

async function createUserWithRole(role, emailSuffix) {
    return User.create({
        email: `role-test-${emailSuffix}@expedinap.com`,
        password: 'TestPass123',
        firstName: 'Role',
        lastName: `Test ${emailSuffix}`,
        role: role
    });
}

async function testRoute(label, path, token, expectedStatus) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await request(path, { headers });
    const passed = res.status === expectedStatus;
    console.log(
        `  ${passed ? '✅' : '❌'} ${label}: status=${res.status} (expected ${expectedStatus})`
    );
    if (!passed) {
        console.log('     Response:', res.body);
    }
    return passed;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // 1. Crear un usuario por rol
        // Necesitamos una empresa para company_admin y operator
        const { Company } = require('../../src/models');
        const testCompany = await Company.create({
            rnc: '130999333',
            name: 'Role Test Company'
        });

        const admin = await createUserWithRole('admin', 'admin');
        const companyAdmin = await User.create({
            email: 'role-test-company@expedinap.com',
            password: 'TestPass123',
            firstName: 'Company',
            lastName: 'Admin',
            role: 'company_admin',
            companyId: testCompany.id
        });
        const operator = await User.create({
            email: 'role-test-operator@expedinap.com',
            password: 'TestPass123',
            firstName: 'Operator',
            lastName: 'User',
            role: 'operator',
            companyId: testCompany.id
        });

        console.log('✅ Users created (admin, company_admin, operator)\n');

        // 2. Generar tokens
        const adminToken = signAccessToken({
            userId: admin.id,
            role: admin.role,
            companyId: admin.companyId
        });
        const companyToken = signAccessToken({
            userId: companyAdmin.id,
            role: companyAdmin.role,
            companyId: companyAdmin.companyId
        });
        const operatorToken = signAccessToken({
            userId: operator.id,
            role: operator.role,
            companyId: operator.companyId
        });

        // 3. Probar ruta OPERATOR LEVEL (todos deberían pasar)
        console.log('--- Ruta nivel OPERATOR ---');
        await testRoute('admin', ROUTES.operatorLevel, adminToken, 200);
        await testRoute('company_admin', ROUTES.operatorLevel, companyToken, 200);
        await testRoute('operator', ROUTES.operatorLevel, operatorToken, 200);
        await testRoute('sin token', ROUTES.operatorLevel, null, 401);

        // 4. Probar ruta COMPANY LEVEL (admin y company_admin pasan, operator no)
        console.log('\n--- Ruta nivel COMPANY_ADMIN ---');
        await testRoute('admin', ROUTES.companyLevel, adminToken, 200);
        await testRoute('company_admin', ROUTES.companyLevel, companyToken, 200);
        await testRoute('operator', ROUTES.companyLevel, operatorToken, 403);
        await testRoute('sin token', ROUTES.companyLevel, null, 401);

        // 5. Probar ruta ADMIN LEVEL (solo admin)
        console.log('\n--- Ruta nivel ADMIN ---');
        await testRoute('admin', ROUTES.adminLevel, adminToken, 200);
        await testRoute('company_admin', ROUTES.adminLevel, companyToken, 403);
        await testRoute('operator', ROUTES.adminLevel, operatorToken, 403);
        await testRoute('sin token', ROUTES.adminLevel, null, 401);

        // 6. Limpiar
        await admin.destroy();
        await companyAdmin.destroy();
        await operator.destroy();
        await testCompany.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();