require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company } = require('../../src/models');
const { signAccessToken } = require('../../src/shared/utils/jwt');

async function testRoute(label, path, token, expectedStatus, expectedTenantId) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await request(path, { headers });
    const passed = res.status === expectedStatus;

    console.log(`  ${passed ? '✅' : '❌'} ${label}: status=${res.status} (expected ${expectedStatus})`);
    if (res.body && res.body.tenantCompanyId !== undefined) {
        const tenantMatch = res.body.tenantCompanyId === expectedTenantId;
        console.log(`     tenantCompanyId: ${res.body.tenantCompanyId} (expected ${expectedTenantId}) ${tenantMatch ? '✅' : '❌'}`);
    }
    if (!passed) {
        console.log('     Response:', res.body);
    }
    return passed;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // 1. Crear dos empresas
        const companyA = await Company.create({ rnc: '130999222', name: 'Company A' });
        const companyB = await Company.create({ rnc: '130999111', name: 'Company B' });

        // 2. Crear usuarios
        const admin = await User.create({
            email: 'tenant-admin@expedinap.com',
            password: 'TestPass123',
            firstName: 'Tenant',
            lastName: 'Admin',
            role: 'admin'
        });

        const adminA = await User.create({
            email: 'tenant-admin-a@expedinap.com',
            password: 'TestPass123',
            firstName: 'Admin',
            lastName: 'Company A',
            role: 'company_admin',
            companyId: companyA.id
        });

        const operatorB = await User.create({
            email: 'tenant-operator-b@expedinap.com',
            password: 'TestPass123',
            firstName: 'Operator',
            lastName: 'Company B',
            role: 'operator',
            companyId: companyB.id
        });

        console.log('✅ Setup completed\n');

        // 3. Generar tokens
        const adminToken = signAccessToken({ userId: admin.id, role: admin.role, companyId: admin.companyId });
        const adminAToken = signAccessToken({ userId: adminA.id, role: adminA.role, companyId: adminA.companyId });
        const operatorBToken = signAccessToken({ userId: operatorB.id, role: operatorB.role, companyId: operatorB.companyId });

        // 4. Probar la ruta (agregar temporalmente /api/auth/test/tenant en auth.routes.js)
        const route = '/api/auth/test/tenant';

        console.log('--- Test tenant middleware ---');
        await testRoute('admin', route, adminToken, 200, null);
        await testRoute('company_admin (A)', route, adminAToken, 200, companyA.id);
        await testRoute('operator (B)', route, operatorBToken, 200, companyB.id);
        await testRoute('sin token', route, null, 401, undefined);

        // 5. Limpiar
        await admin.destroy();
        await adminA.destroy();
        await operatorB.destroy();
        await companyA.destroy();
        await companyB.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();