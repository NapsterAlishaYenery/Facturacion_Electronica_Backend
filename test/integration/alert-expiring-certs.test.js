// ============================================================
// Test de integración: alert-expiring-certs.job
//
// Verifica que el job detecta empresas con certificado próximo
// a vencer (<= 30 días) y las lista. Es read-only.
//
// Uso:
//   node test/integration/alert-expiring-certs.test.js
// ============================================================

require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('../../src/config/database');
const {
    Company, Subscription, User, AuditLog
} = require('../../src/models');

const job = require('../../src/modules/jobs/jobs/alert-expiring-certs.job');
const runJob = job._raw;

const RNC_EXPIRING = '130999980';
const RNC_EXPIRED = '130999981';
const RNC_FAR = '130999982';
const RNC_INACTIVE = '130999983';

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

function daysFromNow(n) {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function cleanup() {
    const rncs = [RNC_EXPIRING, RNC_EXPIRED, RNC_FAR, RNC_INACTIVE];
    const companies = await Company.findAll({ where: { rnc: { [Op.in]: rncs } } });
    const ids = companies.map(c => c.id);
    if (ids.length === 0) return;

    await AuditLog.destroy({
        where: {
            [Op.or]: [
                { companyId: { [Op.in]: ids } },
                { action: { [Op.like]: 'job.alert-expiring-certs%' } }
            ]
        }
    });
    await Subscription.destroy({ where: { companyId: { [Op.in]: ids } } });
    await User.destroy({ where: { companyId: { [Op.in]: ids } } });
    await Company.destroy({ where: { id: { [Op.in]: ids } } });
}

async function setup() {
    await cleanup();

    await Company.create({
        rnc: RNC_EXPIRING,
        name: 'Test Expiring Cert SRL',
        email: 'expiring@test.com',
        certificateExpiresAt: daysFromNow(15),
        isActive: true
    });

    await Company.create({
        rnc: RNC_EXPIRED,
        name: 'Test Expired Cert SRL',
        email: 'expired@test.com',
        certificateExpiresAt: daysFromNow(-5),
        isActive: true
    });

    await Company.create({
        rnc: RNC_FAR,
        name: 'Test Far Cert SRL',
        email: 'far@test.com',
        certificateExpiresAt: daysFromNow(90),
        isActive: true
    });

    await Company.create({
        rnc: RNC_INACTIVE,
        name: 'Test Inactive Cert SRL',
        email: 'inactive@test.com',
        certificateExpiresAt: daysFromNow(10),
        isActive: false
    });
}

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        await setup();
        console.log('✅ Setup completed\n');

        // ----------------------------------------------------
        // TEST 1: detecta empresa con cert por vencer (15d)
        // ----------------------------------------------------
        console.log('--- Test 1: detecta empresa con cert por vencer (15d) ---');
        let result = await runJob();

        const detectedIds = result.companies.map(c => c.rnc);
        test('detecta RNC_EXPIRING (15d)', detectedIds.includes(RNC_EXPIRING), `got ${JSON.stringify(detectedIds)}`);

        // ----------------------------------------------------
        // TEST 2: detecta empresa con cert ya vencido
        // ----------------------------------------------------
        console.log('\n--- Test 2: detecta empresa con cert ya vencido ---');
        test('detecta RNC_EXPIRED (-5d)', detectedIds.includes(RNC_EXPIRED));

        // ----------------------------------------------------
        // TEST 3: NO detecta empresa con cert lejano (90d)
        // ----------------------------------------------------
        console.log('\n--- Test 3: NO detecta cert lejano (90d) ---');
        test('no detecta RNC_FAR', !detectedIds.includes(RNC_FAR));

        // ----------------------------------------------------
        // TEST 4: NO detecta empresa inactiva
        // ----------------------------------------------------
        console.log('\n--- Test 4: NO detecta empresa inactiva ---');
        test('no detecta RNC_INACTIVE', !detectedIds.includes(RNC_INACTIVE));

        // ----------------------------------------------------
        // TEST 5: affected = 2 (solo la expiring y la expired)
        // ----------------------------------------------------
        console.log('\n--- Test 5: affected = 2 ---');
        test('affected = 2', result.affected === 2, `got ${result.affected}`);

        // ----------------------------------------------------
        // TEST 6: audit log insertado
        // ----------------------------------------------------
        console.log('\n--- Test 6: audit log ---');
        const auditCount = await AuditLog.count({
            where: { action: 'job.alert-expiring-certs' }
        });
        test('audit_log insertado', auditCount >= 1, `got ${auditCount}`);

        // ----------------------------------------------------
        // TEST 7: idempotencia (segunda corrida)
        // ----------------------------------------------------
        console.log('\n--- Test 7: idempotencia ---');
        result = await runJob();
        test('segunda corrida affected = 2 (no cambia nada)', result.affected === 2, `got ${result.affected}`);

        console.log('\n✅ Tests completados');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            await cleanup();
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        await sequelize.close();
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();