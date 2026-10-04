// ============================================================
// TEST: notifications.service (Step 6.4)
// Ejecutar: node test/unit/notifications_service.test.js
//
// Mockea el email adapter para no enviar correos reales.
// Verifica que el service: renderiza template + arma subject +
// llama al adapter con los datos correctos.
// ============================================================

// ------------------------------------------------------------
// MOCK: interceptar el email adapter ANTES de requerir el service
// ------------------------------------------------------------
const emailAdapter = require('../../src/modules/notifications/adapters/email.adapter');
const originalSend = emailAdapter.send;

let capturedSends = [];

emailAdapter.send = async (payload) => {
    capturedSends.push(payload);
    return { messageId: 'mock-service-id-' + capturedSends.length };
};

// Ahora sí, requerimos el service (ya con el adapter mockeado)
const service = require('../../src/modules/notifications/notifications.service');

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

function reset() {
    capturedSends = [];
}

// ------------------------------------------------------------
// Runner
// ------------------------------------------------------------
(async () => {
    // ------------------------------------------------------------
    // API pública
    // ------------------------------------------------------------
    console.log('=== notifications.service — API ===\n');
    test('exporta sendPasswordResetCode',
        typeof service.sendPasswordResetCode === 'function');

    // ------------------------------------------------------------
    // sendPasswordResetCode — happy path
    // ------------------------------------------------------------
    console.log('\n=== sendPasswordResetCode — happy path ===\n');
    reset();
    {
        const info = await service.sendPasswordResetCode({
            to: 'juan@test.local',
            name: 'Juan',
            code: '123456',
            expiresInMinutes: 15
        });

        test('devuelve info del adapter',
            info && typeof info.messageId === 'string');
        test('capturó 1 envío', capturedSends.length === 1);

        const sent = capturedSends[0];
        test('to correcto', sent.to === 'juan@test.local');
        test('subject viene del template',
            sent.subject === 'Código de recuperación de contraseña');
        test('html es string no vacío',
            typeof sent.html === 'string' && sent.html.length > 100);
        test('text es string no vacío',
            typeof sent.text === 'string' && sent.text.length > 20);
        test('html contiene el código', sent.html.includes('123456'));
        test('text contiene el código', sent.text.includes('123456'));
        test('html contiene el nombre', sent.html.includes('Juan'));
    }

    // ------------------------------------------------------------
    // sendPasswordResetCode — sin nombre (default "usuario")
    // ------------------------------------------------------------
    console.log('\n=== sendPasswordResetCode — sin nombre ===\n');
    reset();
    {
        await service.sendPasswordResetCode({
            to: 'x@test.local',
            code: '999999'
        });

        const sent = capturedSends[0];
        test('usa "usuario" cuando no hay nombre',
            sent.html.includes('usuario'));
    }

    // ------------------------------------------------------------
    // Propaga errores del template (ej: falta code)
    // ------------------------------------------------------------
    console.log('\n=== Propagación de errores ===\n');
    reset();
    {
        let err = null;
        try {
            await service.sendPasswordResetCode({
                to: 'x@test.local'
                // sin code
            });
        } catch (e) { err = e; }

        test('lanza si el template falla',
            err && err.message.includes('code is required'), err?.message);
        test('no se llamó al adapter',
            capturedSends.length === 0);
    }

    // ------------------------------------------------------------
    // Restaurar adapter original
    // ------------------------------------------------------------
    emailAdapter.send = originalSend;

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
})();