// ============================================================
// Validaciones Joi para el módulo auth
// ============================================================

const Joi = require('joi');

// ------------------------------------------------------------
// Schema: registro de empresa + dueño
// ------------------------------------------------------------
const registerCompanySchema = Joi.object({
    // Datos de la empresa
    company: Joi.object({
        rnc: Joi.string().pattern(/^\d{9}$|^\d{11}$/).required()
            .messages({
                'string.pattern.base': 'RNC must be 9 or 11 digits',
                'any.required': 'Company RNC is required'
            }),
        name: Joi.string().min(2).max(200).required()
            .messages({
                'string.min': 'Company name must be at least 2 characters',
                'any.required': 'Company name is required'
            }),
        tradeName: Joi.string().max(200).optional().allow(null, ''),
        email: Joi.string().email().max(150).optional().allow(null, ''),
        phone: Joi.string().max(30).optional().allow(null, ''),
        address: Joi.string().max(300).optional().allow(null, ''),
        economicActivity: Joi.string().max(200).optional().allow(null, ''),
        dgiiEnvironment: Joi.string().valid('testecf', 'production').default('testecf')
    }).required(),

    // Datos del dueño
    owner: Joi.object({
        email: Joi.string().email().max(150).required()
            .messages({
                'string.email': 'Owner email must be a valid email',
                'any.required': 'Owner email is required'
            }),
        password: Joi.string().min(8).max(100).required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'any.required': 'Password is required'
            }),
        firstName: Joi.string().min(2).max(80).required(),
        middleName: Joi.string().max(80).optional().allow(null, ''),
        lastName: Joi.string().min(2).max(80).required(),
        secondLastName: Joi.string().max(80).optional().allow(null, '')
    }).required()
});

// ------------------------------------------------------------
// Schema: login
// ------------------------------------------------------------
const loginSchema = Joi.object({
    email: Joi.string().email().max(150).required()
        .messages({
            'string.email': 'Email must be valid',
            'any.required': 'Email is required'
        }),
    password: Joi.string().min(1).max(100).required()
        .messages({
            'any.required': 'Password is required'
        })
});

// ------------------------------------------------------------
// Schema: actualizar perfil propio
// ------------------------------------------------------------
const updateProfileSchema = Joi.object({
    firstName: Joi.string().min(2).max(80).optional(),
    middleName: Joi.string().max(80).optional().allow(null, ''),
    lastName: Joi.string().min(2).max(80).optional(),
    secondLastName: Joi.string().max(80).optional().allow(null, '')
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});

// ------------------------------------------------------------
// Schema: cambiar contraseña
// ------------------------------------------------------------
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().min(1).max(100).required()
        .messages({
            'any.required': 'Current password is required'
        }),
    newPassword: Joi.string()
        .min(8)
        .max(100)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.min': 'New password must be at least 8 characters',
            'string.pattern.base': 'New password must contain uppercase, lowercase and a number',
            'any.required': 'New password is required'
        })
});

// ------------------------------------------------------------
// Schema: solicitar reset de contraseña
// ------------------------------------------------------------
const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().max(150).required()
        .messages({
            'string.email': 'Email must be valid',
            'any.required': 'Email is required'
        })
});

// ------------------------------------------------------------
// Schema: resetear contraseña con código
// ------------------------------------------------------------
const resetPasswordSchema = Joi.object({
    email: Joi.string().email().max(150).required(),
    code: Joi.string().length(6).pattern(/^\d{6}$/).required()
        .messages({
            'string.length': 'Code must be 6 digits',
            'string.pattern.base': 'Code must be 6 numeric digits',
            'any.required': 'Code is required'
        }),
    newPassword: Joi.string()
        .min(8)
        .max(100)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters',
            'string.pattern.base': 'Password must contain uppercase, lowercase and a number'
        })
});

// ------------------------------------------------------------
// Schema: refresh token (no requiere body, viene en cookie)
// ------------------------------------------------------------
// No se necesita schema, viene en la cookie.

// ------------------------------------------------------------
// Schema: admin crea un usuario
// ------------------------------------------------------------
const adminCreateUserSchema = Joi.object({
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(8).max(100)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            'string.pattern.base': 'Password must contain uppercase, lowercase and a number'
        }),
    firstName: Joi.string().min(2).max(80).required(),
    middleName: Joi.string().max(80).optional().allow(null, ''),
    lastName: Joi.string().min(2).max(80).required(),
    secondLastName: Joi.string().max(80).optional().allow(null, ''),
    role: Joi.string().valid('admin', 'company_admin', 'operator').required(),
    companyId: Joi.string().uuid().optional().allow(null)
});

// ------------------------------------------------------------
// Schema: company_admin crea un operador
// ------------------------------------------------------------
const companyCreateUserSchema = Joi.object({
    email: Joi.string().email().max(150).required(),
    password: Joi.string().min(8).max(100)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required(),
    firstName: Joi.string().min(2).max(80).required(),
    middleName: Joi.string().max(80).optional().allow(null, ''),
    lastName: Joi.string().min(2).max(80).required(),
    secondLastName: Joi.string().max(80).optional().allow(null, '')
    // No role, no companyId — son fijos
});

// ------------------------------------------------------------
// Schema: actualizar un usuario (por admin o company_admin)
// ------------------------------------------------------------
const updateUserSchema = Joi.object({
    firstName: Joi.string().min(2).max(80).optional(),
    middleName: Joi.string().max(80).optional().allow(null, ''),
    lastName: Joi.string().min(2).max(80).optional(),
    secondLastName: Joi.string().max(80).optional().allow(null, ''),
    isActive: Joi.boolean().optional()
}).min(1).messages({
    'object.min': 'At least one field is required to update'
});

// ------------------------------------------------------------
// Schema: filtros de listado
// ------------------------------------------------------------
const listUsersQuerySchema = Joi.object({
    role: Joi.string().valid('admin', 'company_admin', 'operator').optional(),
    isActive: Joi.boolean().optional(),
    companyId: Joi.string().uuid().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    search: Joi.string().max(100).optional().allow('')
});

module.exports = {
    registerCompanySchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    adminCreateUserSchema,
    companyCreateUserSchema,
    updateUserSchema,
    listUsersQuerySchema
};