require('dotenv').config();
const sequelize = require('../src/config/database');
const { User } = require('../src/models');
const { signAccessToken } = require('../src/shared/utils/jwt');
const http = require('http');

const BASE_URL = 'http://localhost:4001';

// Helper para hacer peticiones HTTP
function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data ? JSON.parse(data) : null
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected');

        // 1. Crear un usuario de prueba
        const user = await User.create({
            email: 'middleware-test@expedinap.com',
            password: 'TestPass123',
            firstName: 'Middleware',
            lastName: 'Test',
            role: 'admin'
        });
        console.log('✅ User created:', user.email);

        // 2. Generar un access token
        const token = signAccessToken({
            userId: user.id,
            role: user.role,
            companyId: user.companyId
        });
        console.log('✅ Token generated');

        // 3. Probar ruta protegida SIN token
        console.log('\n--- Test 1: No token ---');
        const res1 = await request('/api/auth/me-test');
        console.log('Status:', res1.status);
        console.log('Response:', res1.body);

        // 4. Probar ruta protegida CON token inválido
        console.log('\n--- Test 2: Invalid token ---');
        const res2 = await request('/api/auth/me-test', {
            headers: { Authorization: 'Bearer invalid_token_here' }
        });
        console.log('Status:', res2.status);
        console.log('Response:', res2.body);

        // 5. Probar ruta protegida CON token válido
        console.log('\n--- Test 3: Valid token ---');
        const res3 = await request('/api/auth/me-test', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status:', res3.status);
        console.log('Response:', res3.body);

        // 6. Probar ruta protegida con usuario inactivo
        console.log('\n--- Test 4: Inactive user ---');
        await user.update({ isActive: false });
        const res4 = await request('/api/auth/me-test', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status:', res4.status);
        console.log('Response:', res4.body);

        // 7. Limpiar
        await user.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();