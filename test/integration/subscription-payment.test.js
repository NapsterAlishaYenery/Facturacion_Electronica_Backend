require('dotenv').config();
const sequelize = require('../../src/config/database');
const SubscriptionPayment = require('../../src/models/subscriptionPayment.model');
const Subscription = require('../../src/models/subscription.model');
const Company = require('../../src/models/company.model');
const Plan = require('../../src/models/plan.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Crear empresa, plan, suscripción de prueba
        const company = await Company.create({
            rnc: '130999777',
            name: 'Payment Test Company'
        });

        const plan = await Plan.findOne({ where: { code: 'basic' } });

        const subscription = await Subscription.create({
            companyId: company.id,
            planId: plan.id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        console.log('✅ Setup completed');

        // 2. Crear un pago
        const payment = await SubscriptionPayment.create({
            subscriptionId: subscription.id,
            companyId: company.id,
            amount: 1000.00,
            currency: 'DOP',
            paymentMethod: 'transfer',
            reference: 'TRANSF-2026-001',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'paid',
            paidAt: new Date()
        });

        console.log('✅ Payment created:');
        console.log('   ID:', payment.id);
        console.log('   Amount:', payment.amount, payment.currency);
        console.log('   Method:', payment.paymentMethod);
        console.log('   Status:', payment.status);

        // 3. Probar validación: monto negativo
        try {
            await SubscriptionPayment.create({
                subscriptionId: subscription.id,
                companyId: company.id,
                amount: -100,
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            console.log('❌ Should have failed (negative amount)');
        } catch (error) {
            console.log('✅ Validation works (amount):', error.message);
        }

        // 4. Probar validación: period_end antes de period_start
        try {
            await SubscriptionPayment.create({
                subscriptionId: subscription.id,
                companyId: company.id,
                amount: 1000,
                periodStart: new Date(),
                periodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000)
            });
            console.log('❌ Should have failed (period_end before period_start)');
        } catch (error) {
            console.log('✅ Validation works (period):', error.message);
        }

        // 5. Limpiar
        await payment.destroy();
        await subscription.destroy();
        await company.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();