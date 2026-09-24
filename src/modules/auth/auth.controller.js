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

module.exports = {
    registerCompany,
    login,
    logout,
    me,
    updateMe,
    changePassword,
    forgotPassword,
    resetPassword,
    refresh
};