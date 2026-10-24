// ============================================================
// Validaciones Joi para el módulo products
// ============================================================
//
// Notas de diseño:
//  - El POS solo emite tipos 31 y 32.
//  - taxType NUNCA acepta ITBIS_3_46 (solo 46, fuera del POS).
//  - itemCode único por empresa → se valida en el servicio (409).
//  - indicadorBienoServicio es OBLIGATORIO (no default) porque
//    estamos en backend-first (sin frontend acoplado todavía).
//  - Si es Bien (indicadorBienoServicio === 1) → unidadMedida requerido.
//  - gradosAlcohol solo aplica a Bienes (no a Servicios).
//  - fechaVencimientoItem >= fechaElaboracion si ambas vienen.
//  - cantidadReferencia ↔ unidadReferencia (ambas o ninguna).
// ============================================================

const Joi = require('joi');

// Tasa de ITBIS permitida en el POS (sin ITBIS_3_46)
const POS_TAX_TYPES = ['ITBIS_18', 'ITBIS_16', 'EXENTO'];

// ------------------------------------------------------------
// Helper: aplica las reglas cruzadas DGII de un producto
// (idénticas a las del itemSchema de invoices.validation.js)
// ------------------------------------------------------------
function applyCrossFieldRules(value, helpers) {
    const indicador = value.indicadorBienoServicio;

    // 1. Bien requiere unidadMedida
    if (indicador === 1) {
        if (value.unidadMedida === undefined || value.unidadMedida === null) {
            return helpers.error('any.custom', {
                message: 'unidadMedida is required when indicadorBienoServicio=1 (Bien). Use a DGII code 1-62.'
            });
        }
    }

    // 2. Servicio sin gradosAlcohol
    if (indicador === 2
        && value.gradosAlcohol !== undefined
        && value.gradosAlcohol !== null) {
        return helpers.error('any.custom', {
            message: 'gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios'
        });
    }

    // 3. Coherencia cantidadReferencia ↔ unidadReferencia
    const hasCantRef = value.cantidadReferencia !== undefined && value.cantidadReferencia !== null;
    const hasUniRef = value.unidadReferencia !== undefined && value.unidadReferencia !== null;

    if (hasCantRef && !hasUniRef) {
        return helpers.error('any.custom', {
            message: 'unidadReferencia is required when cantidadReferencia is provided'
        });
    }
    if (hasUniRef && !hasCantRef) {
        return helpers.error('any.custom', {
            message: 'cantidadReferencia is required when unidadReferencia is provided'
        });
    }

    // 4. fechaVencimientoItem >= fechaElaboracion
    if (value.fechaElaboracion && value.fechaVencimientoItem) {
        const elab = new Date(value.fechaElaboracion);
        const venc = new Date(value.fechaVencimientoItem);
        if (venc < elab) {
            return helpers.error('any.custom', {
                message: `fechaVencimientoItem (${value.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${value.fechaElaboracion})`
            });
        }
    }

    return value;
}

// ============================================================
// Schema: crear producto
// ============================================================
const createProductSchema = Joi.object({
    // --- Identificación ---
    name: Joi.string().min(2).max(200).required()
        .messages({
            'any.required': 'Product name is required',
            'string.min': 'Product name must be at least 2 characters',
            'string.max': 'Product name cannot exceed 200 characters'
        }),

    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({
            'string.max': 'Product description cannot exceed 1000 characters'
        }),

    price: Joi.number().min(0).max(9999999999.99).required()
        .messages({
            'any.required': 'Product price is required',
            'number.min': 'Product price cannot be negative',
            'number.max': 'Product price is too large'
        }),

    taxType: Joi.string().valid(...POS_TAX_TYPES).required()
        .messages({
            'any.required': 'taxType is required',
            'any.only': 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO'
        }),

    itemCode: Joi.string().max(50).optional().allow(null, '')
        .messages({
            'string.max': 'itemCode cannot exceed 50 characters'
        }),

    isActive: Joi.boolean().default(true),

    // --- Campos DGII nuevos ---
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).required()
        .messages({
            'any.required': 'indicadorBienoServicio is required',
            'any.only': 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)'
        }),

    unidadMedida: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadMedida must be between 1 and 62',
            'number.max': 'unidadMedida must be between 1 and 62'
        }),

    gradosAlcohol: Joi.number().min(0).max(100).optional().allow(null)
        .messages({
            'number.min': 'gradosAlcohol cannot be negative',
            'number.max': 'gradosAlcohol cannot exceed 100'
        }),

    fechaElaboracion: Joi.date().iso().optional().allow(null),
    fechaVencimientoItem: Joi.date().iso().optional().allow(null),

    cantidadReferencia: Joi.number().min(0).optional().allow(null)
        .messages({
            'number.min': 'cantidadReferencia cannot be negative'
        }),

    unidadReferencia: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadReferencia must be between 1 and 62',
            'number.max': 'unidadReferencia must be between 1 and 62'
        }),

    precioUnitarioReferencia: Joi.number().min(0).optional().allow(null)
        .messages({
            'number.min': 'precioUnitarioReferencia cannot be negative'
        })
})
    .custom(applyCrossFieldRules)
    .messages({
        'any.custom': '{{#message}}'
    });

// ============================================================
// Schema: actualizar producto (parcial)
// ============================================================
//
// OJO: aquí no podemos validar "Bien requiere unidadMedida" con
// certeza, porque el update es parcial y no sabemos si
// indicadorBienoServicio/unidadMedida ya estaban en BD.
// Esa coherencia final se valida en el SERVICIO (P3) leyendo
// el estado actual del producto + el update.
// ============================================================
const updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(200).optional()
        .messages({
            'string.min': 'Product name must be at least 2 characters',
            'string.max': 'Product name cannot exceed 200 characters'
        }),

    description: Joi.string().max(1000).optional().allow(null, '')
        .messages({
            'string.max': 'Product description cannot exceed 1000 characters'
        }),

    price: Joi.number().min(0).max(9999999999.99).optional()
        .messages({
            'number.min': 'Product price cannot be negative',
            'number.max': 'Product price is too large'
        }),

    taxType: Joi.string().valid(...POS_TAX_TYPES).optional()
        .messages({
            'any.only': 'taxType must be one of: ITBIS_18, ITBIS_16, EXENTO'
        }),

    itemCode: Joi.string().max(50).optional().allow(null, '')
        .messages({
            'string.max': 'itemCode cannot exceed 50 characters'
        }),

    isActive: Joi.boolean().optional(),

    // --- Campos DGII nuevos (todos opcionales en update) ---
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).optional()
        .messages({
            'any.only': 'indicadorBienoServicio must be 1 (Bien) or 2 (Servicio)'
        }),

    unidadMedida: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadMedida must be between 1 and 62',
            'number.max': 'unidadMedida must be between 1 and 62'
        }),

    gradosAlcohol: Joi.number().min(0).max(100).optional().allow(null)
        .messages({
            'number.min': 'gradosAlcohol cannot be negative',
            'number.max': 'gradosAlcohol cannot exceed 100'
        }),

    fechaElaboracion: Joi.date().iso().optional().allow(null),
    fechaVencimientoItem: Joi.date().iso().optional().allow(null),

    cantidadReferencia: Joi.number().min(0).optional().allow(null)
        .messages({
            'number.min': 'cantidadReferencia cannot be negative'
        }),

    unidadReferencia: Joi.number().integer().min(1).max(62).optional().allow(null)
        .messages({
            'number.min': 'unidadReferencia must be between 1 and 62',
            'number.max': 'unidadReferencia must be between 1 and 62'
        }),

    precioUnitarioReferencia: Joi.number().min(0).optional().allow(null)
        .messages({
            'number.min': 'precioUnitarioReferencia cannot be negative'
        })
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required to update'
    })
    .custom((value, helpers) => {
        // En update solo validamos reglas LOCALES que no dependen
        // del estado previo en BD:
        //   - gradosAlcohol en servicio (si el body trae ambos)
        //   - cantidadReferencia ↔ unidadReferencia (si el body trae ambas)
        //   - fechaVencimientoItem >= fechaElaboracion (si el body trae ambas)
        // La coherencia Bien↔unidadMedida se valida en el servicio (P3).

        // 1. gradosAlcohol en servicio
        if (value.indicadorBienoServicio === 2
            && value.gradosAlcohol !== undefined
            && value.gradosAlcohol !== null) {
            return helpers.error('any.custom', {
                message: 'gradosAlcohol only applies to bienes (indicadorBienoServicio=1), not servicios'
            });
        }

        // 2. cantidadReferencia ↔ unidadReferencia (si ambos en el body)
        const hasCantRef = value.cantidadReferencia !== undefined && value.cantidadReferencia !== null;
        const hasUniRef = value.unidadReferencia !== undefined && value.unidadReferencia !== null;
        if (hasCantRef && !hasUniRef) {
            return helpers.error('any.custom', {
                message: 'unidadReferencia is required when cantidadReferencia is provided'
            });
        }
        if (hasUniRef && !hasCantRef) {
            return helpers.error('any.custom', {
                message: 'cantidadReferencia is required when unidadReferencia is provided'
            });
        }

        // 3. fechaVencimientoItem >= fechaElaboracion (si ambas en el body)
        if (value.fechaElaboracion && value.fechaVencimientoItem) {
            const elab = new Date(value.fechaElaboracion);
            const venc = new Date(value.fechaVencimientoItem);
            if (venc < elab) {
                return helpers.error('any.custom', {
                    message: `fechaVencimientoItem (${value.fechaVencimientoItem}) cannot be earlier than fechaElaboracion (${value.fechaElaboracion})`
                });
            }
        }

        return value;
    })
    .messages({
        'any.custom': '{{#message}}'
    });

// ============================================================
// Schema: listar (query)
// ============================================================
const listProductsQuerySchema = Joi.object({
    isActive: Joi.boolean().truthy('true').falsy('false').optional(),
    indicadorBienoServicio: Joi.number().integer().valid(1, 2).optional(),
    search: Joi.string().max(100).optional().allow(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50)
});

// ============================================================
// Schema: activar/desactivar
// ============================================================
const toggleProductActiveSchema = Joi.object({
    isActive: Joi.boolean().required()
        .messages({
            'any.required': 'isActive is required',
            'boolean.base': 'isActive must be a boolean'
        })
});

module.exports = {
    createProductSchema,
    updateProductSchema,
    listProductsQuerySchema,
    toggleProductActiveSchema,
    POS_TAX_TYPES
};