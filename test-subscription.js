require('dotenv').config();
const sequelize = require('./src/config/database');
const Subscription = require('./src/models/subscription.model');
const Company = require('./src/models/company.model');
const Plan = require('./src/models/plan.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Crear una empresa de prueba
        const company = await Company.create({
            rnc: '130999888',
            name: 'Test Company SRL'
        });
        console.log('✅ Company created:', company.name);

        // 2. Buscar un plan
        const plan = await Plan.findOne({ where: { code: 'basic' } });
        console.log('✅ Plan found:', plan.name);

        // 3. Crear una suscripción en trial
        const subscription = await Subscription.create({
            companyId: company.id,
            planId: plan.id,
            status: 'trial',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 días
        });

        console.log('✅ Subscription created:');
        console.log('   ID:', subscription.id);
        console.log('   Status:', subscription.status);
        console.log('   Trial ends:', subscription.trialEndsAt);
        console.log('   Company ID:', subscription.companyId);
        console.log('   Plan ID:', subscription.planId);
        console.log('   Invoices used:', subscription.invoicesUsedThisMonth);

        // 4. Probar validación: ends_at antes de starts_at
        try {
            subscription.endsAt = new Date('2020-01-01');
            await subscription.save();
            console.log('❌ Should have failed (ends_at before starts_at)');
        } catch (error) {
            console.log('✅ Validation works:', error.message);
        }

        // 5. Limpiar
        await subscription.destroy();
        await company.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();