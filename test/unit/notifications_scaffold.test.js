// ============================================================
// TEST: notifications module — scaffold (Step 6.1)
//
// Verifica que:
//   1. El módulo se puede requerir sin lanzar error.
//   2. El barrel exporta un objeto (contrato de API).
//   3. El factory de adapters lanza error en canal desconocido.
//   4. El factory NO lanza error al importar (sintaxis OK).
//
// Ejecutar: node test/unit/test_notifications_scaffold.js
// ============================================================

const path = require('path');

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

console.log('=== TESTS: notifications scaffold (Step 6.1) ===\n');

// ------------------------------------------------------------
// 1. El módulo raíz se puede requerir
// ------------------------------------------------------------
let notifications = null;
try {
    notifications = require('../../src/modules/notifications');
} catch (err) {
    test('require(notifications) no lanza error', false, err.message);
    process.exit(1);
}
test('require(notifications) no lanza error', true);

// ------------------------------------------------------------
// 2. Contrato del barrel
// ------------------------------------------------------------
test('barrel exporta un objeto', typeof notifications === 'object' && notifications !== null);

// ------------------------------------------------------------
// 3. Los submódulos se pueden requerir
// ------------------------------------------------------------
try {
    require('../../src/modules/notifications/notifications.templates');
    test('require(notifications.templates) OK', true);
} catch (err) {
    test('require(notifications.templates) OK', false, err.message);
}

try {
    require('../../src/modules/notifications/notifications.service');
    test('require(notifications.service) OK', true);
} catch (err) {
    test('require(notifications.service) OK', false, err.message);
}

try {
    require('../../src/modules/notifications/adapters/email.adapter');
    test('require(email.adapter) OK', true);
} catch (err) {
    test('require(email.adapter) OK', false, err.message);
}

// ------------------------------------------------------------
// 4. Factory de adapters: contrato
// ------------------------------------------------------------
const { getAdapter } = require('../../src/modules/notifications/adapters');

test('getAdapter es una función', typeof getAdapter === 'function');

try {
    getAdapter('sms');
    test('getAdapter("sms") lanza error', false, 'no lanzó');
} catch (err) {
    test(
        'getAdapter("sms") lanza error con mensaje esperado',
        err.message.includes('not supported'),
        err.message
    );
}

// ------------------------------------------------------------
// Resultado final
// ------------------------------------------------------------
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);