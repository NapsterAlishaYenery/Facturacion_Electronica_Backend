require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');

async function testValidation(label, body, expectedStatus, expectedCodeOrField) {
    const res = await request('/api/auth/test/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const passed = res.status === expectedStatus;
    console.log(`  ${passed ? '✅' : '❌'} ${label}: status=${res.status} (expected ${expectedStatus})`);

    if (!passed || (expectedCodeOrField && res.body?.error)) {
        console.log(`     Response:`, JSON.stringify(res.body, null, 2));
    }
    return passed;
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        console.log('--- Test validate middleware ---');

        // 1. Body válido
        await testValidation(
            'valid body',
            { email: 'test@example.com', password: 'SecurePass123' },
            200
        );

        // 2. Email inválido
        await testValidation(
            'invalid email',
            { email: 'not-an-email', password: 'SecurePass123' },
            400
        );

        // 3. Password corta
        await testValidation(
            'short password',
            { email: 'test@example.com', password: '123' },
            400
        );

        // 4. Campos faltantes
        await testValidation(
            'missing fields',
            {},
            400
        );

        // 5. Campo no permitido (debe ser eliminado)
        const res = await request('/api/auth/test/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'SecurePass123',
                role: 'admin'  // ← NO está en el schema
            })
        });
        const roleStripped = res.body?.data?.receivedRole === undefined;
        console.log(`  ${roleStripped ? '✅' : '❌'} unknown field stripped: receivedRole=${res.body?.data?.receivedRole}`);

        // 6. Múltiples errores a la vez
        await testValidation(
            'multiple errors at once',
            { email: 'bad', password: 'x' },
            400
        );

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();