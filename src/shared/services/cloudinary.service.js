// ============================================================
// Servicio genérico de Cloudinary
// Acepta Buffer o ruta de archivo. Devuelve metadata normalizada.
// No conoce el dominio (logos, productos, etc.): solo sube bytes.
// ============================================================

const fs = require('fs').promises;
const path = require('path');
const cloudinary = require('../../config/cloudinary');

// ------------------------------------------------------------
// Normaliza la respuesta de Cloudinary a un shape estable
// ------------------------------------------------------------
function normalizeResult(result) {
    return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format || null,
        resourceType: result.resource_type, // 'image' | 'video' | 'raw'
        width: result.width || 0,
        height: result.height || 0,
        bytes: result.bytes || 0,
        duration: result.duration || null // solo videos
    };
}

// ------------------------------------------------------------
// Sube un archivo a Cloudinary
//
// @param {Buffer|string} source - Buffer del archivo o ruta local
// @param {object} options
//   - folder {string}        carpeta base (ej: 'ExpediFact/logos/abc')
//   - publicId {string}      si se pasa, sobrescribe (overwrite)
//   - transformation {array} transformaciones de Cloudinary
//   - resourceType {string}  'image' | 'video' | 'raw' (default: 'auto')
//   - tags {array}           tags opcionales
// @returns {Promise<object>} metadata normalizada
// ------------------------------------------------------------
async function upload(source, options = {}) {
    const {
        folder,
        publicId = null,
        transformation = null,
        resourceType = 'auto',
        tags = null
    } = options;

    if (!folder) {
        throw new Error('cloudinary.service.upload: folder is required');
    }

    const uploadOptions = {
        folder,
        resource_type: resourceType,
        overwrite: !!publicId,        // solo sobrescribe si se da publicId
        use_filename: !publicId,      // si no hay publicId, usa el nombre del archivo
        unique_filename: !publicId,   // si no hay publicId, genera uno único
        invalidate: !!publicId        // purga CDN si sobrescribe
    };

    if (publicId) uploadOptions.public_id = publicId;
    if (transformation) uploadOptions.transformation = transformation;
    if (tags) uploadOptions.tags = tags;

    try {
        let result;

        if (Buffer.isBuffer(source)) {
            // ---- Caso Buffer (multer memoryStorage) ----
            result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    uploadOptions,
                    (error, res) => {
                        if (error) return reject(error);
                        resolve(res);
                    }
                );
                stream.end(source);
            });
        } else if (typeof source === 'string') {
            // ---- Caso ruta de archivo (multer diskStorage) ----
            result = await cloudinary.uploader.upload(source, uploadOptions);
        } else {
            throw new Error('cloudinary.service.upload: source must be Buffer or file path string');
        }

        return normalizeResult(result);

    } catch (error) {
        // Log detallado para debugging, pero error genérico hacia arriba
        console.error('Cloudinary Service Error:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
        });
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
}

// ------------------------------------------------------------
// Elimina un archivo de Cloudinary
//
// @param {string} publicId
// @param {string} resourceType - 'image' | 'video' | 'raw' (default: 'image')
// @returns {Promise<object>} resultado de Cloudinary ({ result: 'ok' | 'not found' })
// ------------------------------------------------------------
async function remove(publicId, resourceType = 'image') {
    if (!publicId) {
        throw new Error('cloudinary.service.remove: publicId is required');
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });

        return result;

    } catch (error) {
        console.error('Cloudinary Service Delete Error:', {
            message: error.message,
            publicId
        });
        throw new Error(`Cloudinary delete failed: ${error.message}`);
    }
}

// ------------------------------------------------------------
// Construye una URL transformada a partir de un publicId
// Útil para generar thumbnails sin subir archivos nuevos
// ------------------------------------------------------------
function buildUrl(publicId, transformation = null, resourceType = 'image') {
    if (!publicId) {
        throw new Error('cloudinary.service.buildUrl: publicId is required');
    }

    const base = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        transformation: transformation || undefined
    });

    return base;
}

// ------------------------------------------------------------
// Helper: borra un archivo local de forma tolerante (ENOENT ok)
// Pensado para usarse en el `finally` de controladores con
// multer diskStorage. No se usa con memoryStorage.
// ------------------------------------------------------------
async function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        await fs.unlink(path.resolve(filePath));
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.warn(`cloudinary.service.safeUnlink: could not delete ${filePath}`, err.message);
        }
    }
}

module.exports = {
    upload,
    remove,
    buildUrl,
    safeUnlink
};