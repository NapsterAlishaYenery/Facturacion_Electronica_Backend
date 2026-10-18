// ============================================================
// Configuración de multer para upload del logo de la empresa
// - memoryStorage: el archivo va a Cloudinary como Buffer
// - 2MB máximo
// - Solo PNG, JPG, SVG, WebP
// - Los errores de multer se normalizan a AppError (400)
// ============================================================

const multer = require('multer');
const { AppError } = require('../../shared/middlewares/error.middleware');

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const ALLOWED_MIMETYPES = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp'
];

// ------------------------------------------------------------
// Filtro: valida mimetype
// La extensión se valida implícitamente por el mimetype;
// no aceptamos octet-stream para logos (a diferencia del .p12)
// ------------------------------------------------------------
function fileFilter(req, file, cb) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(new AppError(
            `Invalid logo mimetype "${file.mimetype}". Allowed: PNG, JPG, SVG, WebP.`,
            400,
            'LOGO_INVALID_MIMETYPE'
        ));
    }
    cb(null, true);
}

// ------------------------------------------------------------
// Multer base
// ------------------------------------------------------------
const multerLogo = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_SIZE_BYTES,
        files: 1 // solo 1 archivo por request
    },
    fileFilter
}).single('logo'); // el campo del form-data se llama "logo"

// ------------------------------------------------------------
// Wrapper: normaliza errores de multer a AppError
// Multer lanza MulterError para límites (tamaño, campos, etc.)
// y AppError para el fileFilter. Los MulterError no tienen
// statusCode → el error.middleware los trataría como 500.
// Este wrapper los convierte a 400 con código específico.
// ------------------------------------------------------------
function uploadLogo(req, res, next) {
    multerLogo(req, res, (err) => {
        if (!err) return next();

        // Errores de multer (límites, campos inesperados)
        if (err instanceof multer.MulterError) {
            const codeMap = {
                LIMIT_FILE_SIZE: 'LOGO_FILE_TOO_LARGE',
                LIMIT_FILE_COUNT: 'LOGO_TOO_MANY_FILES',
                LIMIT_UNEXPECTED_FILE: 'LOGO_UNEXPECTED_FIELD',
                LIMIT_PART_COUNT: 'LOGO_INVALID_FORM'
            };
            const code = codeMap[err.code] || 'LOGO_UPLOAD_ERROR';
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? `Logo file too large. Maximum size is ${MAX_SIZE_BYTES / (1024 * 1024)}MB.`
                : err.message;

            return next(new AppError(message, 400, code));
        }

        // AppError del fileFilter → pasar tal cual
        if (err instanceof AppError) {
            return next(err);
        }

        // Cualquier otro error inesperado → 500
        return next(err);
    });
}

module.exports = {
    uploadLogo,
    MAX_SIZE_BYTES,
    ALLOWED_MIMETYPES
};