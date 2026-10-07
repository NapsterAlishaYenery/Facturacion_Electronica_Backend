require('dotenv').config();
const { request } = require('../helpers/http.helper');
const sequelize = require('../../src/config/database');
const { Plan } = require('../../src/models');

async function test(label, condition, extra = '') {
    console.log(`  ${condition ? '✅' : '❌'} ${label}${extra ? ': ' + extra : ''}`);
    return condition;
}

(async () => {
    let createdPlanId = null;
    const testCode = 'TEST_PLAN_7_2';

    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        // Limpieza previa
        await Plan.destroy({ where: { code: testCode } });

        // Setup: crear plan activo de prueba
        const createdPlan = await Plan.create({
            code: testCode,
            name: 'Plan Test 7.2',
            description: 'Plan creado para test de GET /api/plans/:id',
            priceDop: 999.99,
            priceUsd: 16.99,
            invoicesPerMonth: 100,
            maxUsers: 2,
            maxSequences: 1,
            features: { reports: false, support: 'email' },
            isActive: true
        });
        createdPlanId = createdPlan.id;

        // Crear plan inactivo (para test 404)
        const inactivePlan = await Plan.create({
            code: testCode + '_INACTIVE',
            name: 'Plan Test Inactivo',
            priceDop: 1.00,
            invoicesPerMonth: 1,
            maxUsers: 1,
            maxSequences: 1,
            isActive: false
        });
        const inactivePlanId = inactivePlan.id;

        console.log('✅ Setup completed\n');

        // ============================================================
        // Test 1: GET plan existente y activo
        // ============================================================
        console.log('--- Test 1: Plan activo existente ---');
        const res = await request(`/api/plans/${createdPlanId}`);

        await test('status 200', res.status === 200, `got ${res.status}`);
        await test('success true', res.body?.success === true);
        await test('plan id matches', res.body?.data?.plan?.id === createdPlanId);
        await test('plan code matches', res.body?.data?.plan?.code === testCode);
        await test('plan name matches', res.body?.data?.plan?.name === 'Plan Test 7.2');
        await test('plan isActive true', res.body?.data?.plan?.isActive === true);

        // ============================================================
        // Test 2: GET plan inactivo → 404
        // ============================================================
        console.log('\n--- Test 2: Plan inactivo devuelve 404 ---');
        const inactiveRes = await request(`/api/plans/${inactivePlanId}`);

        await test('status 404', inactiveRes.status === 404, `got ${inactiveRes.status}`);
        await test('code PLAN_NOT_FOUND', inactiveRes.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 3: GET ID que no existe → 404
        // ============================================================
        console.log('\n--- Test 3: UUID válido inexistente ---');
        const notFoundRes = await request('/api/plans/00000000-0000-0000-0000-000000000000');

        await test('status 404', notFoundRes.status === 404, `got ${notFoundRes.status}`);
        await test('code PLAN_NOT_FOUND', notFoundRes.body?.error?.code === 'PLAN_NOT_FOUND');

        // ============================================================
        // Test 4: ID con formato inválido → 400
        // ============================================================
        console.log('\n--- Test 4: ID con formato inválido ---');
        const badIdRes = await request('/api/plans/not-a-uuid');

        await test('status 400', badIdRes.status === 400, `got ${badIdRes.status}`);
        await test('code INVALID_ID_FORMAT', badIdRes.body?.error?.code === 'INVALID_ID_FORMAT');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (createdPlanId) {
                await Plan.destroy({ where: { id: createdPlanId } });
            }
            await Plan.destroy({ where: { code: testCode } });
            await Plan.destroy({ where: { code: testCode + '_INACTIVE' } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        process.exit(0);
    }
})();