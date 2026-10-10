// ============================================================
// Configuración de multer para upload de certificados .p12
// - memoryStorage: el archivo nunca toca disco sin cifrar
// - 5MB máximo
// - Solo .p12 y .pfx
// ============================================================

const multer = require('multer');
const path = require('path');
const { AppError } = require('../../shared/middlewares/error.middleware');

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.p12', '.pfx'];
const ALLOWED_MIMETYPES = [
    'application/x-pkcs12',
    'application/pkcs12',
    'application/octet-stream' // algunos navegadores no reconocen .p12
];

// ------------------------------------------------------------
// Filtro: valida extensión + mimetype
// ------------------------------------------------------------
function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new AppError(
            `Invalid file extension "${ext}". Only .p12 and .pfx are allowed.`,
            400,
            'CERTIFICATE_INVALID_EXTENSION'
        ));
    }

    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(new AppError(
            `Invalid file mimetype "${file.mimetype}".`,
            400,
            'CERTIFICATE_INVALID_MIMETYPE'
        ));
    }

    cb(null, true);
}

const uploadCertificate = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter
}).single('certificate'); // el campo del form-data se llama "certificate"

module.exports = { uploadCertificate };