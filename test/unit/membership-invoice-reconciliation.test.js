// test/unit/membership-invoice-reconciliation.test.js
const {
    shouldProcess,
    hasReachedMaxAttempts,
    buildAttemptUpdate,
    formatAuditMeta,
    MAX_ATTEMPTS,
    WINDOW_DAYS
} = require('../../src/modules/jobs/jobs/membership-invoice-reconciliation.job');

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

// ------------------------------------------------------------
// Helper: construir un pago mock
// ------------------------------------------------------------
function mockPayment(overrides = {}) {
    return {
        id: 'pay-1',
        status: 'paid',
        invoiceId: null,
        amount: 1000,
        paidAt: new Date(),
        invoiceGenerationAttempts: 0,
        ...overrides
    };
}

// ============================================================
// shouldProcess
// ============================================================
console.log('=== TESTS: shouldProcess ===\n');

test('pago normal → true',
    shouldProcess(mockPayment()) === true);

test('status != paid → false',
    shouldProcess(mockPayment({ status: 'pending' })) === false);

test('ya tiene invoiceId → false',
    shouldProcess(mockPayment({ invoiceId: 'inv-1' })) === false);

test('amount 0 → false',
    shouldProcess(mockPayment({ amount: 0 })) === false);

test('amount negativo → false',
    shouldProcess(mockPayment({ amount: -100 })) === false);

test('attempts = MAX → false',
    shouldProcess(mockPayment({ invoiceGenerationAttempts: MAX_ATTEMPTS })) === false);

test('attempts > MAX → false',
    shouldProcess(mockPayment({ invoiceGenerationAttempts: MAX_ATTEMPTS + 1 })) === false);

test('attempts = MAX - 1 → true',
    shouldProcess(mockPayment({ invoiceGenerationAttempts: MAX_ATTEMPTS - 1 })) === true);

test('paidAt fuera de ventana → false',
    shouldProcess(mockPayment({
        paidAt: new Date(Date.now() - (WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000)
    })) === false);

test('paidAt dentro de ventana → true',
    shouldProcess(mockPayment({
        paidAt: new Date(Date.now() - (WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000)
    })) === true);

test('payment null → false', shouldProcess(null) === false);

// ============================================================
// hasReachedMaxAttempts
// ============================================================
console.log('\n=== TESTS: hasReachedMaxAttempts ===\n');

test('0 → false', hasReachedMaxAttempts({ invoiceGenerationAttempts: 0 }) === false);
test('1 → false', hasReachedMaxAttempts({ invoiceGenerationAttempts: 1 }) === false);
test('4 → false', hasReachedMaxAttempts({ invoiceGenerationAttempts: 4 }) === false);
test('5 → true', hasReachedMaxAttempts({ invoiceGenerationAttempts: 5 }) === true);
test('10 → true', hasReachedMaxAttempts({ invoiceGenerationAttempts: 10 }) === true);
test('undefined → false', hasReachedMaxAttempts({}) === false);
test('null payment → false', hasReachedMaxAttempts(null) === false);

// ============================================================
// buildAttemptUpdate
// ============================================================
console.log('\n=== TESTS: buildAttemptUpdate ===\n');

const update1 = buildAttemptUpdate({ invoiceGenerationAttempts: 2 }, 'error X');
test('incrementa attempts', update1.invoiceGenerationAttempts === 3);
test('incluye lastInvoiceAttemptAt', update1.lastInvoiceAttemptAt instanceof Date);

const update2 = buildAttemptUpdate({}, 'error');
test('attempts undefined → 1', update2.invoiceGenerationAttempts === 1);

// ============================================================
// formatAuditMeta
// ============================================================
console.log('\n=== TESTS: formatAuditMeta ===\n');

const meta = formatAuditMeta({ regenerated: 3, failed: 1, exhausted: 2, skipped: 0 });
test('entity correcto', meta.entity === 'subscription_payment');
test('regenerated', meta.regenerated === 3);
test('failed', meta.failed === 1);
test('exhausted', meta.exhausted === 2);
test('skipped', meta.skipped === 0);
test('maxAttempts', meta.maxAttempts === MAX_ATTEMPTS);
test('windowDays', meta.windowDays === WINDOW_DAYS);

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);