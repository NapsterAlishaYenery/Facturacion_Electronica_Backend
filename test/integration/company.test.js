require('dotenv').config();
const sequelize = require('../../src/config/database');
const Company = require('../../src/models/company.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión OK');

        // Probar query con el modelo
        const companies = await Company.findAll();
        console.log('📋 Empresas en BD:', companies.length);

        companies.forEach(c => {
            console.log(`   - ${c.rnc} | ${c.name} | ${c.dgiiEnvironment}`);
        });

     await Company.destroy({ where: { rnc: '130123456' } });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();