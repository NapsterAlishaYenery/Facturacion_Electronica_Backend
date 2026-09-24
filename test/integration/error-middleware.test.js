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
        console.log('     Expected:', { status: expectedStatus, code: expectedCode });
        console.log('     Response:', JSON.stringify(res.body, null, 2));
    }
}

(async () => {
    let testCompany;
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpiar cualquier residuo de tests anteriores
        await Company.destroy({ where: { rnc: '130999000' } });

        // Crear la empresa de prueba
        testCompany = await Company.create({
            rnc: '130999000',
            name: 'Error Test Company'
        });
        console.log('✅ Test company created:', testCompany.rnc, '\n');

        console.log('--- Test error middleware ---');

        // 1. Ruta no encontrada → 404
        await testError('route not found', '/api/nonexistent', {}, 404, 'ROUTE_NOT_FOUND');

        // 2. AppError → 400
        await testError('app error 400', '/api/auth/test/error-400', {}, 400, 'TEST_ERROR');

        // 3. AppError → 403
        await testError('app error 403', '/api/auth/test/error-403', {}, 403, 'FORBIDDEN');

        // 4. AppError → 404
        await testError('app error 404', '/api/auth/test/error-404', {}, 404, 'NOT_FOUND_RESOURCE');

        // 5. Validación Sequelize
        const res5 = await request('/api/auth/test/error-validation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const test5OK = res5.status === 400 && res5.body?.error?.code === 'VALIDATION_ERROR';
        console.log(`  ${test5OK ? '✅' : '❌'} sequelize validation: status=${res5.status}, code=${res5.body?.error?.code}`);
        if (!test5OK) {
            console.log('     Response:', JSON.stringify(res5.body, null, 2));
        }

        // 6. Unique constraint (RNC duplicado)
        const res6 = await request('/api/auth/test/error-unique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rnc: '130999000' })
        });
        const test6OK = res6.status === 409 && res6.body?.error?.code === 'DUPLICATE_ENTRY';
        console.log(`  ${test6OK ? '✅' : '❌'} unique constraint: status=${res6.status}, code=${res6.body?.error?.code}`);
        if (!test6OK) {
            console.log('     Response:', JSON.stringify(res6.body, null, 2));
        }

        // 7. Error interno 500
        await testError('internal error 500', '/api/auth/test/error-500', {}, 500, 'INTERNAL_ERROR');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        // Limpieza garantizada
        try {
            await Company.destroy({ where: { rnc: '130999000' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();