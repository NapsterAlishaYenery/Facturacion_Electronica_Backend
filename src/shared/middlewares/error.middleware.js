// ============================================================
// Middleware de manejo de errores
// Captura TODOS los errores y los convierte en respuestas JSON
// Debe registrarse al final de todos los middlewares y rutas
// ============================================================

const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');

// ------------------------------------------------------------
// Clase de error personalizada para errores controlados
// Uso: throw new AppError('Message', 400, 'ERROR_CODE')
// ------------------------------------------------------------
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true; // Distingue errores controlados de bugs
        Error.captureStackTrace(this, this.constructor);
    }
}

// ------------------------------------------------------------
// Middleware principal
// ------------------------------------------------------------
function errorMiddleware(err, req, res, next) {
    // Log del error para debugging
    logError(err, req);

    // Determinar status, code y message según el tipo de error
    const { statusCode, code, message, details } = normalizeError(err);

    // Construir respuesta
    const response = {
        success: false,
        error: {
            code,
            message
        }
    };

    // Agregar detalles solo si existen
    if (details) {
        response.error.details = details;
    }

    // En desarrollo, agregar stack trace
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

// ------------------------------------------------------------
// Normaliza cualquier tipo de error a { statusCode, code, message, details }
// ------------------------------------------------------------
function normalizeError(err) {
    // 1. Errores personalizados (los que lanzamos con AppError)
    if (err instanceof AppError) {
        return {
            statusCode: err.statusCode,
            code: err.code,
            message: err.message
        };
    }

    // 2. Errores de validación de Sequelize (fallan validaciones del modelo)
    if (err instanceof ValidationError) {
        const details = err.errors.map(e => ({
            field: e.path,
            message: e.message,
            type: e.type
        }));
        return {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details
        };
    }

    // 3. Errores de unique constraint (ej: RNC duplicado)
    if (err instanceof UniqueConstraintError) {
        const details = err.errors.map(e => ({
            field: e.path,
            value: e.value,
            message: e.message
        }));
        return {
            statusCode: 409,
            code: 'DUPLICATE_ENTRY',
            message: 'A record with this value already exists',
            details
        };
    }

    // 4. Errores de foreign key (ej: referencia a empresa inexistente)
    if (err instanceof ForeignKeyConstraintError) {
        return {
            statusCode: 400,
            code: 'FOREIGN_KEY_ERROR',
            message: 'Referenced record does not exist'
        };
    }

    // 5. Errores de JWT (por si el authMiddleware no los capturó)
    if (err.name === 'JsonWebTokenError') {
        return {
            statusCode: 401,
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token'
        };
    }
    if (err.name === 'TokenExpiredError') {
        return {
            statusCode: 401,
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired'
        };
    }

    // 6. Error 404 para rutas no encontradas
    if (err.statusCode === 404 || err.status === 404) {
        return {
            statusCode: 404,
            code: 'NOT_FOUND',
            message: err.message || 'Resource not found'
        };
    }

    // 7. Errores con statusCode propio (ej: de librerías externas)
    if (err.statusCode || err.status) {
        return {
            statusCode: err.statusCode || err.status,
            code: err.code || 'ERROR',
            message: err.message || 'An error occurred'
        };
    }

    // 8. Error genérico (bug no controlado)
    return {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Unknown error'
    };
}

// ------------------------------------------------------------
// Log del error
// ------------------------------------------------------------
function logError(err, req) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const userId = req.user?.id || 'anonymous';

    // En desarrollo: log detallado
    if (process.env.NODE_ENV === 'development') {
        console.error(`\n[${timestamp}] ${method} ${url}`);
        console.error(`  User: ${userId}`);
        console.error(`  Error: ${err.message}`);
        console.error(`  Stack: ${err.stack}`);
    } else {
        // En producción: log mínimo (aquí luego conectarás un logger real)
        console.error(`[${timestamp}] ${method} ${url} - ${err.message}`);
    }
}

// ------------------------------------------------------------
// Middleware para rutas no encontradas (404)
// Debe registrarse ANTES del errorMiddleware
// ------------------------------------------------------------
function notFoundMiddleware(req, res, next) {
    const error = new AppError(
        `Route not found: ${req.method} ${req.originalUrl}`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
}

module.exports = {
    errorMiddleware,
    notFoundMiddleware,
    AppError
};