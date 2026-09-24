require('dotenv').config();
const sequelize = require('../../src/config/database');
const Sequence = require('../../src/models/sequence.model');
const Company = require('../../src/models/company.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Crear empresa de prueba
        const company = await Company.create({
            rnc: '130999666',
            name: 'Sequence Test Company'
        });

        // 2. Crear una secuencia para tipo 32 (Factura de Consumo)
        const sequence = await Sequence.create({
            companyId: company.id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 1000,
            currentNumber: 0,
            expiresAt: new Date('2026-12-31')
        });

        console.log('✅ Sequence created:');
        console.log('   ID:', sequence.id);
        console.log('   Type:', sequence.type);
        console.log('   Range:', sequence.startNumber, '-', sequence.endNumber);
        console.log('   Current:', sequence.currentNumber);
        console.log('   Expires:', sequence.expiresAt);

        // 3. Simular emisión: tomar siguiente número
        const nextNumber = sequence.currentNumber + 1;
        const ncf = sequence.prefix + sequence.type + String(nextNumber).padStart(10, '0');
        console.log('   Next NCF would be:', ncf);

        // 4. Simular emisión del segundo
        sequence.currentNumber = 1;
        const nextNumber2 = sequence.currentNumber + 1;
        const ncf2 = sequence.prefix + sequence.type + String(nextNumber2).padStart(10, '0');
        console.log('   Second NCF would be:', ncf2);

        // 5. Probar validación: current_number fuera de rango
        try {
            sequence.currentNumber = 2000;
            await sequence.save();
            console.log('❌ Should have failed (current_number > end_number)');
        } catch (error) {
            console.log('✅ Validation works (range):', error.message);
        }

        // 6. Probar validación: end_number < start_number
        try {
            await Sequence.create({
                companyId: company.id,
                type: '31',
                startNumber: 1000,
                endNumber: 500,
                currentNumber: 0,
                expiresAt: new Date('2026-12-31')
            });
            console.log('❌ Should have failed (end < start)');
        } catch (error) {
            console.log('✅ Validation works (end < start):', error.message);
        }

        // 7. Limpiar
        await sequence.destroy();
        await company.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();