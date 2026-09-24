require('dotenv').config();
const sequelize = require('../src/config/database');
const AuditLog = require('../src/models/auditLog.model');
const User = require('../src/models/user.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Crear un admin para asociar el log
        const user = await User.create({
            email: 'audit-test@expedinap.com',
            password: 'TestPass123',
            firstName: 'Audit',
            lastName: 'Test',
            role: 'admin'
        });
        console.log('✅ User created:', user.email);

        // 2. Crear un log
        const log = await AuditLog.create({
            userId: user.id,
            action: 'user.login',
            entity: 'user',
            entityId: user.id,
            after: { email: user.email, role: user.role },
            ip: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Test)'
        });

        console.log('✅ Log created:');
        console.log('   ID:', log.id);
        console.log('   Action:', log.action);
        console.log('   Entity:', log.entity);
        console.log('   IP:', log.ip);
        console.log('   Created at:', log.createdAt);

        // 3. Leer logs
        const logs = await AuditLog.findAll({ limit: 5 });
        console.log('📋 Total logs (showing up to 5):', logs.length);

        // 4. Probar inmutabilidad: intentar update
        try {
            log.action = 'hacked';
            await log.save();
            console.log('❌ Should have failed (update not allowed)');
        } catch (error) {
            console.log('✅ Immutability works (update):', error.message);
        }

        // 5. Probar inmutabilidad: intentar delete con el modelo
        try {
            await log.destroy();
            console.log('❌ Should have failed (delete not allowed)');
        } catch (error) {
            console.log('✅ Immutability works (delete):', error.message);
        }

        // 6. Limpiar con query cruda (la única forma permitida)
        await sequelize.query(
            'DELETE FROM audit_logs WHERE user_id = :userId',
            { replacements: { userId: user.id } }
        );
        console.log('🧹 Log deleted with raw query');

        // 7. Limpiar usuario
        await user.destroy();
        console.log('🧹 User deleted');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();