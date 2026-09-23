require('dotenv').config();
const sequelize = require('./src/config/database');
const User = require('./src/models/user.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Listar usuarios existentes
        const users = await User.findAll();
        console.log('📋 Users in DB:', users.length);
        users.forEach(u => {
            console.log(`   - ${u.email} | ${u.fullName} | ${u.role}`);
        });

        // 2. Crear un usuario nuevo con los campos nuevos
        const newUser = await User.create({
            email: 'juan.perez@expedinap.com',
            password: 'MySecurePass123',
            firstName: 'Juan',
            middleName: 'Carlos',
            lastName: 'Pérez',
            secondLastName: 'Gómez',
            role: 'admin'
        });

        console.log('\n✅ User created:', newUser.email);
        console.log('   Full name (virtual):', newUser.fullName);
        console.log('   Hash length:', newUser.passwordHash.length);
        console.log('   Hash starts with:', newUser.passwordHash.substring(0, 10));

        // 3. Validar contraseña correcta
        const isValid = await newUser.validatePassword('MySecurePass123');
        console.log('   Password validation:', isValid ? '✅ Correct' : '❌ Failed');

        // 4. Validar contraseña incorrecta
        const isInvalid = await newUser.validatePassword('WrongPassword');
        console.log('   Wrong password test:', isInvalid ? '❌ Should fail' : '✅ Correctly rejected');

        // 5. Buscar por email (case insensitive)
        const found = await User.findByEmail('JUAN.PEREZ@EXPEDINAP.COM');
        console.log('   Find by email (case insensitive):', found ? '✅ Found' : '❌ Not found');

        // 6. Limpiar
        await newUser.destroy();
        console.log('\n🧹 Test user deleted');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();