require('dotenv').config();
const sequelize = require('./src/config/database');
const Plan = require('./src/models/plan.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        const plans = await Plan.findAll();
        console.log('📋 Plans in DB:', plans.length);

        plans.forEach(p => {
            console.log(`   - ${p.code} | ${p.name} | DOP ${p.priceDop} | Invoices: ${p.invoicesPerMonth}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();