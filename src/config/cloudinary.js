// ============================================================
// Configuración de Cloudinary
// Solo inicializa el SDK con las credenciales del .env
// La lógica de subida vive en shared/services/cloudinary.service.js
// ============================================================

const cloudinary = require('cloudinary').v2;

// Validación temprana: si faltan credenciales, fallar al arrancar
const required = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // siempre https
});

module.exports = cloudinary;