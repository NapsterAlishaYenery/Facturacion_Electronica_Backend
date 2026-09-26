// ============================================================
// Controlador de autenticación
// Solo maneja HTTP: llama al servicio, maneja cookies, responde
// ============================================================

const authService = require('./auth.service');
const catchAsync = require('../../shared/utils/catchAsync');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Opciones de las cookies
// ------------------------------------------------------------
const COOKIE_OPTIONS = {
    httpOnly: true,                                  // No accesible desde JS
    secure: process.env.NODE_ENV === 'production',   // Solo HTTPS en prod
    sameSite: 'lax',                                 // Protección CSRF básica
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000                  // 7 días
};

const ACCESS_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000                           // 15 minutos
};

// ------------------------------------------------------------
// POST /api/auth/register-company
// ------------------------------------------------------------
const registerCompany = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await authService.registerCompany(req.body, reqInfo);

    // Setear cookies
    res.cookie('access_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
        success: true,
        message: 'Company registered successfully',
        data: {
            user: result.user,
            company: result.company,
            subscription: result.subscription
        }
    });
});

// ------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------
const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const result = await authService.login(email, password, reqInfo);

    // Setear cookies
    res.cookie('access_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: result.user
        }
    });
});

// ------------------------------------------------------------
// POST /api/auth/logout
// ------------------------------------------------------------
const logout = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    await authService.logout(req.user, reqInfo);

    // Borrar cookies
    res.clearCookie('access_token', { ...ACCESS_COOKIE_OPTIONS, maxAge: 0 });
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, maxAge: 0 });

    res.json({
        success: true,
        message: 'Logout successful'
    });
});

// ------------------------------------------------------------
// GET /api/auth/me
// ------------------------------------------------------------
const me = catchAsync(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.id);

    res.json({
        success: true,
        data: { user }
    });
});

// ------------------------------------------------------------
// PATCH /api/auth/me
// ------------------------------------------------------------
const updateMe = catchAsync(async (req, res) => {
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    const updatedUser = await authService.updateProfile(req.user.id, req.body, reqInfo);

    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
    });
});

// ------------------------------------------------------------
// PATCH /api/auth/change-password
// ------------------------------------------------------------
const changePassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    await authService.changePassword(req.user.id, currentPassword, newPassword, reqInfo);

    res.json({
        success: true,
        message: 'Password changed successfully'
    });
});

// ------------------------------------------------------------
// POST /api/auth/forgot-password
// ------------------------------------------------------------
const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    await authService.forgotPassword(email, reqInfo);

    // Respuesta genérica: NO revelar si el email existe o no
    res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent.'
    });
});

// ------------------------------------------------------------
// POST /api/auth/reset-password
// ------------------------------------------------------------
const resetPassword = catchAsync(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const reqInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    await authService.resetPassword(email, code, newPassword, reqInfo);

    res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
    });
});

// ------------------------------------------------------------
// POST /api/auth/refresh
// ------------------------------------------------------------
const refresh = catchAsync(async (req, res) => {
    // Leer refresh token desde cookie
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
        throw new AppError('No refresh token provided', 401, 'NO_REFRESH_TOKEN');
    }

    const result = await authService.refreshAccessToken(refreshToken);

    // Setear nuevo access token
    res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000
    });

    res.json({
        success: true,
        message: 'Token refreshed'
    });
});


// ------------------------------------------------------------
// GET /api/auth/users (admin)
// ------------------------------------------------------------
const listUsers = catchAsync(async (req, res) => {
    const result = await authService.listUsers(req.user, req.validated.query);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// POST /api/auth/users (admin)
// ------------------------------------------------------------
const createUser = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const user = await authService.createUser(req.user, req.body, reqInfo);

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user }
    });
});

// ------------------------------------------------------------
// PATCH /api/auth/users/:id/activate (admin)
// ------------------------------------------------------------
const toggleUserActive = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const { isActive } = req.body;

    const user = await authService.updateUser(req.user, req.params.id, { isActive }, reqInfo);

    res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: { user }
    });
});

// ------------------------------------------------------------
// DELETE /api/auth/users/:id (admin)
// ------------------------------------------------------------
const deleteUser = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const result = await authService.deleteUser(req.user, req.params.id, reqInfo);

    res.json({
        success: true,
        message: result.deleted ? 'User deleted' : 'User deactivated',
        data: result
    });
});

// ------------------------------------------------------------
// GET /api/auth/company/users (company_admin)
// ------------------------------------------------------------
const listCompanyUsers = catchAsync(async (req, res) => {
    const result = await authService.listUsers(req.user, req.validated.query);

    res.json({
        success: true,
        data: result
    });
});

// ------------------------------------------------------------
// POST /api/auth/company/users (company_admin)
// ------------------------------------------------------------
const createCompanyUser = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const user = await authService.createUser(req.user, req.body, reqInfo);

    res.status(201).json({
        success: true,
        message: 'Operator created successfully',
        data: { user }
    });
});

// ------------------------------------------------------------
// PATCH /api/auth/company/users/:id (company_admin)
// ------------------------------------------------------------
const updateCompanyUser = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const user = await authService.updateUser(req.user, req.params.id, req.body, reqInfo);

    res.json({
        success: true,
        message: 'User updated successfully',
        data: { user }
    });
});

// ------------------------------------------------------------
// DELETE /api/auth/company/users/:id (company_admin)
// ------------------------------------------------------------
const deleteCompanyUser = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };
    const result = await authService.deleteUser(req.user, req.params.id, reqInfo);

    res.json({
        success: true,
        message: result.deleted ? 'User deleted' : 'User deactivated',
        data: result
    });
});

module.exports = {
    registerCompany,
    login,
    logout,
    me,
    updateMe,
    changePassword,
    forgotPassword,
    resetPassword,
    refresh,
    listUsers,
    createUser,
    toggleUserActive,
    deleteUser,
    listCompanyUsers,
    createCompanyUser,
    updateCompanyUser,
    deleteCompanyUser
};