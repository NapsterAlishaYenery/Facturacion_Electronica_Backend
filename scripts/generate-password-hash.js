const bcrypt = require('bcryptjs');

// =====================================================
// CONTRASEÑA QUE QUEREMOS CONVERTIR EN HASH
// =====================================================
// Por ahora usa una contraseña temporal.
// Luego podemos cambiarla por la contraseña real del admin.
const password = 'Admin1234';

async function generateHash() {
    try {
        // Generamos el hash usando 12 salt rounds,
        // igual que tu modelo User.
        const hash = await bcrypt.hash(password, 12);

        console.log('\n========================================');
        console.log('PASSWORD:', password);
        console.log('BCRYPT HASH:', hash);
        console.log('========================================\n');
    } catch (error) {
        console.error('Error generando el hash:', error);
    }
}

generateHash();