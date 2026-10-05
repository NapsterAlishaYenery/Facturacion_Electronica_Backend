// ============================================================
// Servicio de autenticación
// Contiene TODA la lógica de negocio del módulo auth
// Nunca toca req ni res
// ============================================================
const { hashPassword, generateTemporaryPassword } = require('../../shared/utils/password');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { User, Company, Subscription, Plan, AuditLog } = require('../../models');
const { TRIAL_DAYS } = require('../../constants/subscription');
const notificationsConfig = require('../../config/notifications');
const { signAccessToken, signRefreshToken } = require('../../shared/utils/jwt');
const { AppError } = require('../../shared/middlewares/error.middleware');
const notifications = require('../notifications');

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
            trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS); // 25 días de prueba

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

        return { company, user, subscription, plan: basicPlan };
    });


    // 6. Enviar notificaciones (fuera de la transacción)
    //    try/catch individual: si una falla, la otra igual se intenta,
    //    y ninguna rompe el registro (la empresa ya está creada).
    try {
        await notifications.sendWelcome({
            to: result.user.email,
            name: result.user.firstName,
            companyName: result.company.name,
            rnc: result.company.rnc,
            planName: result.plan?.name || null,
            trialDays: TRIAL_DAYS
        });
    } catch (err) {
        console.error('[auth.registerCompany] Welcome email failed:', err.message);
    }

    try {
        const notifyEmail = notificationsConfig.alerts.registrationNotifyEmail;
        if (notifyEmail) {
            await notifications.sendNewCompanyAlert({
                to: notifyEmail,
                company: result.company,
                owner: result.user,
                subscription: result.subscription,
                plan: result.plan,
                meta: { ip: reqInfo.ip, userAgent: reqInfo.userAgent }
            });
        }
    } catch (err) {
        console.error('[auth.registerCompany] Internal alert email failed:', err.message);
    }

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

    // 6. Enviar correo de confirmación (alerta de seguridad)
    //    try/catch: si SMTP falla, no rompemos el cambio de contraseña.
    //    El usuario ya cambió su clave; solo no recibió el aviso.
    try {
        await notifications.sendPasswordReset({
            to: user.email,
            name: user.firstName,
            when: new Date(),
            ip: reqInfo.ip || null
        });
    } catch (err) {
        console.error('[auth.changePassword] Confirmation email failed:', err.message);
    }


    return { success: true };
}

// ------------------------------------------------------------
// Solicitar reset de contraseña
// ------------------------------------------------------------
async function forgotPassword(email, reqInfo = {}) {
    // 1. Buscar el usuario
    const user = await User.findByEmail(email);

    // Por seguridad: no revelar si el email existe o no
    // Devolver siempre "success" aunque no exista
    if (!user || !user.isActive) {
        return { sent: true };
    }

    // 2. Invalidar códigos anteriores no usados
    const { PasswordReset } = require('../../models');
    await PasswordReset.update(
        { usedAt: new Date() },
        { where: { userId: user.id, usedAt: null } }
    );

    // 3. Generar nuevo código
    const { generate6DigitCode } = require('../../shared/utils/codes');
    const code = generate6DigitCode();

    // 4. Expira en 15 minutos
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 5. Guardar en BD
    await PasswordReset.create({
        userId: user.id,
        code,
        expiresAt
    });

    // 6. Enviar email con el código de recuperación
    //    try/catch: si SMTP falla, no rompemos el flujo.
    //    El usuario ya tiene el código en BD; solo no lo recibió.
    //    No revelamos el fallo al cliente por seguridad.
    try {
        await notifications.sendPasswordResetCode({
            to: user.email,
            name: user.firstName,
            code,
            expiresInMinutes: 15
        });
    } catch (err) {
        console.error('[auth.forgotPassword] Email send failed:', err.message);
    }

    // TODO: Integrar con nodemailer o Resend en producción

    // 7. Audit log
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.password_reset_requested',
            entity: 'user',
            entityId: user.id,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return { sent: true };
}

// ------------------------------------------------------------
// Resetear contraseña con código
// ------------------------------------------------------------
async function resetPassword(email, code, newPassword, reqInfo = {}) {
    const { PasswordReset } = require('../../models');

    // 1. Buscar el usuario
    const user = await User.findByEmail(email);
    if (!user || !user.isActive) {
        throw new AppError('Invalid or expired code', 400, 'INVALID_RESET_CODE');
    }

    // 2. Buscar el código
    const reset = await PasswordReset.findOne({
        where: {
            userId: user.id,
            code,
            usedAt: null
        },
        order: [['createdAt', 'DESC']]
    });

    if (!reset) {
        throw new AppError('Invalid or expired code', 400, 'INVALID_RESET_CODE');
    }

    // 3. Verificar expiración
    if (new Date() > reset.expiresAt) {
        throw new AppError('Invalid or expired code', 400, 'INVALID_RESET_CODE');
    }

    // 4. Hashear la nueva contraseña
    const newHash = await hashPassword(newPassword);

    // 5. Actualizar en transacción
    await sequelize.transaction(async (t) => {
        await user.update({ passwordHash: newHash }, { transaction: t });
        await reset.update({ usedAt: new Date() }, { transaction: t });
    });

    // 6. Audit log
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: user.id,
            action: 'user.password_reset_completed',
            entity: 'user',
            entityId: user.id,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // 7. Enviar correo de confirmación (alerta de seguridad)
    //    try/catch: si SMTP falla, no rompemos el reset exitoso.
    //    El usuario ya cambió su contraseña; solo no recibió el aviso.
    try {
        await notifications.sendPasswordReset({
            to: user.email,
            name: user.firstName,
            when: new Date(),
            ip: reqInfo.ip || null
        });
    } catch (err) {
        console.error('[auth.resetPassword] Confirmation email failed:', err.message);
    }

    return { success: true };
}

// ------------------------------------------------------------
// Refrescar access token
// ------------------------------------------------------------
async function refreshAccessToken(refreshToken) {
    const { verifyRefreshToken, signAccessToken } = require('../../shared/utils/jwt');

    // 1. Verificar el refresh token (lanza error si es inválido o expiró)
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    } catch (err) {
        throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // 2. Buscar el usuario
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401, 'USER_NOT_FOUND');
    }

    // 3. Generar nuevo access token
    const accessToken = signAccessToken({
        userId: user.id,
        role: user.role,
        companyId: user.companyId
    });

    return { accessToken };
}


// ------------------------------------------------------------
// Listar usuarios (admin ve todos, company_admin ve los de su empresa)
// ------------------------------------------------------------
async function listUsers(reqUser, filters = {}) {
    const where = {};

    if (reqUser.role === 'company_admin') {
        where.companyId = reqUser.companyId;
    } else if (reqUser.role === 'admin' && filters.companyId) {
        where.companyId = filters.companyId;
    }

    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    if (filters.search) {
        where[Op.or] = [
            { email: { [Op.iLike]: `%${filters.search}%` } },
            { firstName: { [Op.iLike]: `%${filters.search}%` } },
            { lastName: { [Op.iLike]: `%${filters.search}%` } }
        ];
    }

    // Paginación basada en page/limit
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['passwordHash'] },
        include: [{
            model: Company,
            as: 'company',
            attributes: ['id', 'rnc', 'name']
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items: rows,
        pagination: {
            page,
            limit,
            totalItems: count,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

// ------------------------------------------------------------
// Crear usuario (admin puede cualquier rol; company_admin solo operator)
// ------------------------------------------------------------
async function createUser(reqUser, userData, reqInfo = {}) {
    const data = { ...userData };

    // Verificaciones según el rol de quien crea
    if (reqUser.role === 'company_admin') {
        // Forzar rol operator y su propia empresa
        data.role = 'operator';
        data.companyId = reqUser.companyId;
    } else if (reqUser.role === 'admin') {
        // Admin: validar reglas de negocio
        if (data.role === 'admin' && data.companyId) {
            throw new AppError('Admin users cannot belong to a company', 400, 'INVALID_ROLE_COMPANY');
        }
        if (['company_admin', 'operator'].includes(data.role) && !data.companyId) {
            throw new AppError('Company users must have a company assigned', 400, 'COMPANY_REQUIRED');
        }
    } else {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
    }

    // Verificar si el email ya existe
    const existing = await User.findOne({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
        throw new AppError('A user with this email already exists', 409, 'EMAIL_ALREADY_EXISTS');
    }

    // Generar contraseña temporal segura (no se pide en el payload)
    const temporaryPassword = generateTemporaryPassword();

    // Crear el usuario con la contraseña temporal
    const user = await User.create({
        email: data.email.toLowerCase().trim(),
        password: temporaryPassword,
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        secondLastName: data.secondLastName || null,
        role: data.role,
        companyId: data.companyId || null
    });

    // Audit log
    try {
        await AuditLog.create({
            companyId: user.companyId,
            userId: reqUser.id,
            action: 'user.created',
            entity: 'user',
            entityId: user.id,
            after: {
                email: user.email,
                role: user.role,
                companyId: user.companyId
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // Enviar correo de bienvenida con credenciales
    // try/catch: si SMTP falla, no rompemos la creación del usuario.
    try {
        // Buscar el nombre de la empresa si aplica
        const company = user.companyId
            ? await Company.findByPk(user.companyId)
            : null;

        await notifications.sendNewUser({
            to: user.email,
            name: user.firstName,
            email: user.email,
            password: temporaryPassword,
            companyName: company?.name || null
        });
    } catch (err) {
        console.error('[auth.createUser] Welcome email failed:', err.message);
    }

    return sanitizeUser(user);
}

// ------------------------------------------------------------
// Actualizar usuario (admin o company_admin)
// ------------------------------------------------------------
async function updateUser(reqUser, targetUserId, updates, reqInfo = {}) {
    // 1. Buscar el usuario objetivo
    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 2. Verificar permisos
    if (reqUser.role === 'company_admin') {
        // Solo puede editar usuarios de su empresa
        if (targetUser.companyId !== reqUser.companyId) {
            throw new AppError('You can only edit users from your own company', 403, 'FORBIDDEN');
        }
        // No puede cambiar el rol
        // No puede editarse a sí mismo isActive (evitar auto-bloqueo)
        if (targetUser.id === reqUser.id && updates.isActive === false) {
            throw new AppError('You cannot deactivate yourself', 400, 'CANNOT_DEACTIVATE_SELF');
        }
    }

    // 3. Admin no puede desactivarse a sí mismo
    if (reqUser.role === 'admin' && targetUser.id === reqUser.id && updates.isActive === false) {
        throw new AppError('You cannot deactivate yourself', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    // 4. Filtrar campos permitidos
    const allowedFields = ['firstName', 'middleName', 'lastName', 'secondLastName', 'isActive'];
    const updateData = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 5. Guardar estado anterior para audit
    const before = {
        firstName: targetUser.firstName,
        middleName: targetUser.middleName,
        lastName: targetUser.lastName,
        secondLastName: targetUser.secondLastName,
        isActive: targetUser.isActive
    };

    // 6. Actualizar
    await targetUser.update(updateData);

    // 7. Audit log
    try {
        await AuditLog.create({
            companyId: targetUser.companyId,
            userId: reqUser.id,
            action: 'user.updated',
            entity: 'user',
            entityId: targetUser.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return sanitizeUser(targetUser);
}

// ------------------------------------------------------------
// Eliminar usuario (admin: hard delete; company_admin: soft delete)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Eliminar usuario (admin: hard delete; company_admin: soft delete)
// ------------------------------------------------------------
async function deleteUser(reqUser, targetUserId, reqInfo = {}) {
    // 1. Buscar el usuario objetivo
    const targetUser = await User.findByPk(targetUserId);
    if (!targetUser) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // 2. No puede borrarse a sí mismo
    if (targetUser.id === reqUser.id) {
        throw new AppError('You cannot delete yourself', 400, 'CANNOT_DELETE_SELF');
    }

    // 3. Verificar permisos
    if (reqUser.role === 'company_admin') {
        if (targetUser.companyId !== reqUser.companyId) {
            throw new AppError('You can only delete users from your own company', 403, 'FORBIDDEN');
        }

        // Soft delete: solo desactivar
        await targetUser.update({ isActive: false });

        // Audit
        try {
            await AuditLog.create({
                companyId: targetUser.companyId,
                userId: reqUser.id,
                action: 'user.deactivated',
                entity: 'user',
                entityId: targetUser.id,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            });
        } catch (err) { /* ignorar */ }

        // Notificar al company_admin que ejecutó la acción
        // try/catch: si SMTP falla, no rompemos la desactivación.
        try {
            await notifications.sendUserStatusChanged({
                to: reqUser.email,
                action: 'deactivated',
                targetUser: {
                    id: targetUser.id,
                    email: targetUser.email,
                    fullName: targetUser.fullName,
                    role: targetUser.role
                },
                companyName: null,
                executor: reqUser.firstName
            });
        } catch (err) {
            console.error('[auth.deleteUser] Deactivation email failed:', err.message);
        }

        return { deleted: false, deactivated: true };
    }

    // 4. Admin: hard delete
    const before = {
        email: targetUser.email,
        role: targetUser.role,
        companyId: targetUser.companyId,
        fullName: targetUser.fullName    // ← capturar antes del destroy
    };

    await targetUser.destroy();

    // Audit (con companyId del admin porque el usuario ya no existe)
    try {
        await AuditLog.create({
            companyId: reqUser.companyId,
            userId: reqUser.id,
            action: 'user.deleted',
            entity: 'user',
            entityId: targetUserId,
            before,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) { /* ignorar */ }

    // Notificar al admin que ejecutó la acción
    // try/catch: si SMTP falla, no rompemos el borrado.
    try {
        await notifications.sendUserStatusChanged({
            to: reqUser.email,
            action: 'deleted',                    // ← 'deleted', no 'deactivated'
            targetUser: {
                id: targetUserId,
                email: before.email,
                fullName: before.fullName,        // ← del snapshot, no del destroy
                role: before.role
            },
            companyName: null,
            executor: reqUser.firstName
        });
    } catch (err) {
        console.error('[auth.deleteUser] Deletion email failed:', err.message);
    }

    return { deleted: true, deactivated: false };
}

module.exports = {
    registerCompany,
    login,
    logout,
    getCurrentUser,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshAccessToken,
    listUsers,
    createUser,
    updateUser,
    deleteUser
};