// ============================================================
// TEST: integración — POST /api/auth/forgot-password (Step 6.6)
// Ejecutar: node test/integration/forgot-password-email.test.js
//
// REQUIERE:
//   - server corriendo (node src/server.js)
//   - SMTP configurado en .env
//   - usuario con TEST_EMAIL ya creado en DB
//
// ENVÍA UN CORREO REAL al TEST_EMAIL.
// ============================================================

require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { User, PasswordReset, AuditLog } = require('../../src/models');

// ⚠️ CAMBIA ESTO por un email tuyo real que ya exista en la DB
const TEST_EMAIL = 'napsterganc0201@gmail.com';

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // 1. Localizar usuario de prueba
        const user = await User.findOne({ where: { email: TEST_EMAIL } });
        if (!user) {
            console.log(`⚠️  Usuario ${TEST_EMAIL} no existe en la DB.`);
            console.log('   Crea uno primero o cambia TEST_EMAIL a uno real.\n');
            process.exit(1);
        }
        console.log(`→ Usuario encontrado: ${user.email} (id=${user.id}, firstName=${user.firstName})\n`);

        // 2. Limpiar PasswordReset anteriores no usados
        await PasswordReset.destroy({ where: { userId: user.id, usedAt: null } });

        // 3. Disparar el endpoint (email existente)
        console.log(`→ POST /api/auth/forgot-password\n`);
        const res = await request('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TEST_EMAIL })
        });

        test('status 200', res.status === 200,
            `got ${res.status} ${JSON.stringify(res.body?.error || {})}`);
        test('responde { success: true }', res.body?.success === true);
        test('mensaje genérico anti-enumeración',
            typeof res.body?.message === 'string' && res.body.message.length > 0);

        // 4. Verificar PasswordReset en DB
        await new Promise(r => setTimeout(r, 800));

        const reset = await PasswordReset.findOne({
            where: { userId: user.id, usedAt: null },
            order: [['createdAt', 'DESC']]
        });

        test('PasswordReset creado en DB', !!reset);
        test('código tiene 6 dígitos',
            /^\d{6}$/.test(reset?.code || ''), `got "${reset?.code}"`);
        test('expira en el futuro', reset?.expiresAt > new Date());

        if (reset) {
            console.log(`\n📬 CÓDIGO GENERADO: ${reset.code}`);
            console.log(`   Expira: ${reset.expiresAt.toISOString()}`);
            console.log(`   → Verifica MANUALMENTE que llegó el correo a: ${TEST_EMAIL}\n`);
        }

        // 5. AuditLog creado
        const audit = await AuditLog.findOne({
            where: { userId: user.id, action: 'user.password_reset_requested' },
            order: [['createdAt', 'DESC']]
        });
        test('AuditLog user.password_reset_requested creado', !!audit);

        // 6. Email inexistente → MISMA respuesta (no filtra existencia)
        console.log('→ POST /api/auth/forgot-password (email inexistente)\n');
        const resBad = await request('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'no-existe-' + Date.now() + '@test.local' })
        });
        test('email inexistente → 200 igual (seguridad)', resBad.status === 200);
        test('email inexistente → { success: true }', resBad.body?.success === true);
        test('mismo mensaje que el caso exitoso (no filtra)',
            resBad.body?.message === res.body?.message);

        console.log('\n⚠️  Recuerda: revisa tu bandeja de entrada y SPAM.\n');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        console.log(`=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();