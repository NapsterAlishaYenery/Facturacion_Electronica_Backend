require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, Company } = require('../../src/models');

async function testError(label, path, options, expectedStatus, expectedCode) {
    const res = await request(path, options);
    const statusOK = res.status === expectedStatus;
    const codeOK = !expectedCode || res.body?.error?.code === expectedCode;

    console.log(`  ${statusOK && codeOK ? '✅' : '❌'} ${label}: status=${res.status}, code=${res.body?.error?.code}`);
    if (!statusOK || !codeOK) {
        console.log('     Response:', JSON.stringify(res.body, null, 2));
    }
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Crear una empresa para probar unique constraint
        await Company.findOrCreate({
            where: { rnc: '130999000' },
            defaults: { name: 'Error Test Company' }
        });

        console.log('--- Test error middleware ---');

        // 1. Ruta no encontrada → 404
        await testError('route not found', '/api/nonexistent', {}, 404, 'ROUTE_NOT_FOUND');

        // 2. Ruta con AppError → 400
        await testError('app error 400', '/api/auth/test/error-400', {}, 400, 'TEST_ERROR');

        // 3. Ruta con AppError → 403
        await testError('app error 403', '/api/auth/test/error-403', {}, 403, 'FORBIDDEN');

        // 4. Ruta con AppError → 404
        await testError('app error 404', '/api/auth/test/error-404', {}, 404, 'NOT_FOUND_RESOURCE');

        // 5. Ruta con error de validación Sequelize
        const res5 = await request('/api/auth/test/error-validation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        console.log(`  ${res5.status === 400 && res5.body?.error?.code === 'VALIDATION_ERROR' ? '✅' : '❌'} sequelize validation: status=${res5.status}, code=${res5.body?.error?.code}`);

        // 6. Unique constraint: crear empresa con RNC duplicado
        const res6 = await request('/api/auth/test/error-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rnc: '130999000' })
        });
        console.log(`  ${res6.status === 409 && res6.body?.error?.code === 'DUPLICATE_ENTRY' ? '✅' : '❌'} unique constraint: status=${res6.status}, code=${res6.body?.error?.code}`);

        // 7. Error genérico 500
        await testError('internal error 500', '/api/auth/test/error-500', {}, 500, 'INTERNAL_ERROR');

        // Limpiar
        await Company.destroy({ where: { rnc: '130999000' } });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();