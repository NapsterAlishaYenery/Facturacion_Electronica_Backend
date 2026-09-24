// ============================================================
// Servicio de autenticación
// Contiene TODA la lógica de negocio del módulo auth
// Nunca toca req ni res
// ============================================================
const { hashPassword } = require('../../shared/utils/password');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { User, Company, Subscription, Plan, AuditLog } = require('../../models');
const { signAccessToken, signRefreshToken } = require('../../shared/utils/jwt');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Registrar empresa + dueño en una transacción
// ------------------------------------------------------------
async function registerCompany(data, reqInfo = {}) {
    const { company: companyData, owner: ownerData } = data;

    // Verificar si el RNC ya existe
    const existingCompany = await Company.findOne({ where: { rnc: companyData.rnc } });
    if (existingCompany) {
        throw new AppError('A company with this RNC already exists', 409, 'RNC_ALREADY_EXISTS');
    }

    // Verificar si el email del dueño ya existe
    const existingUser = await User.findOne({ where: { email: ownerData.email.toLowerCase().trim() } });
    if (existingUser) {
        throw new AppError('A user with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
    }

    // Transacción: empresa + dueño + suscripción trial
    const result = await sequelize.transaction(async (t) => {
        // 1. Crear la empresa
        const company = await Company.create({
            rnc: companyData.rnc,
            name: companyData.name,
            tradeName: companyData.tradeName || null,
            email: companyData.email || null,
            phone: companyData.phone || null,
            address: companyData.address || null,
            economicActivity: companyData.economicActivity || null,
            dgiiEnvironment: companyData.dgiiEnvironment || 'testecf'
        }, { transaction: t });

        // 2. Crear el dueño (company_admin)
        const user = await User.create({
            companyId: company.id,
            email: ownerData.email.toLowerCase().trim(),
            password: ownerData.password,
            firstName: ownerData.firstName,
            middleName: ownerData.middleName || null,
            lastName: ownerData.lastName,
            secondLastName: ownerData.secondLastName || null,
            role: 'company_admin'
        }, { transaction: t });

        // 3. Buscar el plan básico para asignarlo en trial
        const basicPlan = await Plan.findOne({
            where: { code: 'basic', isActive: true },
            transaction: t
        });

        // 4. Crear la suscripción en trial si hay plan básico
        let subscription = null;
        if (basicPlan) {
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 días de prueba

            subscription = await Subscription.create({
                companyId: company.id,
                planId: basicPlan.id,
                status: 'trial',
                trialEndsAt,
                startsAt: new Date(),
                currentPeriodStart: new Date()
            }, { transaction: t });
        }

        // 5. Registrar en audit_logs
        await AuditLog.create({
            companyId: company.id,
            userId: user.id,
            action: 'company.registered',
            entity: 'company',
            entityId: company.id,
            after: {
                rnc: company.rnc,
                name: company.name,
                ownerEmail: user.email
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        }, { transaction: t });

        return { company, user, subscription };
    });

    // Generar tokens
    const accessToken = signAccessToken({
        userId: result.user.id,
        role: result.user.role,
        companyId: result.user.companyId
    });

    const refreshToken = signRefreshToken({ userId: result.user.id });

    return {
        user: sanitizeUser(result.user),
        company: result.company,
        subscription: result.subscription,
        accessToken,
        refreshToken
    };
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
async function login(email, password, reqInfo = {}) {
    // 1. Buscar el usuario
    const user = await User.findByEmail(email);

    // Mensaje genérico para no filtrar si el email existe o no
    if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // 2. Verificar que esté activo
    if (!user.isActive) {
        throw new AppError('User account is inactive', 403, 'USER_INACTIVE');
    }

    // 3. Validar contraseña
    const isValid = await user.validatePassword(password);
    if (!isValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // 4. Actualizar last_login_at (sin lanzar error si falla)
    try {
        await user.update({ lastLoginAt: new Date() });
    } catch (err) {
        // Ignorar errores de actualización de last_login
    }

    // 5. Registrar en audit_logs
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.login',
            entity: 'user',
            entityId: user.id,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit log en login (no bloquear al usuario)
    }

    // 6. Generar tokens
    const accessToken = signAccessToken({
        userId: user.id,
        role: user.role,
        companyId: user.companyId
    });

    const refreshToken = signRefreshToken({ userId: user.id });

    return {
        user: sanitizeUser(user),
        accessToken,
        refreshToken
    };
}

// ------------------------------------------------------------
// Logout (por ahora solo registra en audit)
// ------------------------------------------------------------
async function logout(user, reqInfo = {}) {
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.logout',
            entity: 'user',
            entityId: user.id,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores
    }
}

// ------------------------------------------------------------
// Obtener el usuario actual (para /me)
// ------------------------------------------------------------
async function getCurrentUser(userId) {
    const user = await User.findByPk(userId, {
        attributes: { exclude: ['passwordHash'] },
        include: [
            {
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'dgiiEnvironment', 'isActive']
            }
        ]
    });

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
}

// ------------------------------------------------------------
// Quita el passwordHash del objeto usuario
// ------------------------------------------------------------
function sanitizeUser(user) {
    const data = user.toJSON ? user.toJSON() : { ...user };
    delete data.passwordHash;
    delete data.password;
    return data;
}

// ------------------------------------------------------------
// Actualizar perfil propio
// ------------------------------------------------------------
async function updateProfile(userId, updates, reqInfo = {}) {
    // 1. Buscar el usuario
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 2. Guardar el estado anterior para audit
    const before = {
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        secondLastName: user.secondLastName
    };

    // 3. Aplicar solo los campos permitidos
    const allowedFields = ['firstName', 'middleName', 'lastName', 'secondLastName'];
    const updateData = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 4. Actualizar
    await user.update(updateData);

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.profile_updated',
            entity: 'user',
            entityId: user.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return sanitizeUser(user);
}

// ------------------------------------------------------------
// Cambiar contraseña
// ------------------------------------------------------------
async function changePassword(userId, currentPassword, newPassword, reqInfo = {}) {
    // 1. Buscar el usuario
    const user = await User.findByPk(userId);
    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 2. Verificar que la contraseña actual sea correcta
    const isValid = await user.validatePassword(currentPassword);
    if (!isValid) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');
    }

    // 3. Verificar que la nueva no sea igual a la actual
    if (currentPassword === newPassword) {
        throw new AppError('New password must be different from current password', 400, 'SAME_PASSWORD');
    }

    // 4. Hashear la nueva contraseña manualmente y actualizar directo
    const newHash = await hashPassword(newPassword);

    await user.update({ passwordHash: newHash });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.password_changed',
            entity: 'user',
            entityId: user.id,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return { success: true };
}

module.exports = {
    registerCompany,
    login,
    logout,
    getCurrentUser,
    updateProfile,
    changePassword
};