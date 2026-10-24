// ============================================================
// Controlador de API Keys (FASE 18.1)
// ============================================================

const catchAsync = require('../../shared/utils/catchAsync');
const apiKeysService = require('./api-keys.service');

// ------------------------------------------------------------
// POST /api/api-keys
// ------------------------------------------------------------
const createApiKey = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };

    const result = await apiKeysService.createApiKey(
        req.user.companyId,
        req.body,
        req.user,
        reqInfo
    );

    // El service devuelve el objeto plano con el secret mezclado.
    // Separamos el secret para devolverlo aparte (solo se ve una vez).
    const { secret, ...apiKeyData } = result;

    res.status(201).json({
        success: true,
        message: 'API key created. Copy the secret now — you will NOT see it again.',
        data: {
            apiKey: apiKeyData,
            secret
        }
    });
});

// ------------------------------------------------------------
// GET /api/api-keys
// ------------------------------------------------------------
const listApiKeys = catchAsync(async (req, res) => {
    const result = await apiKeysService.listApiKeys(req.user.companyId);

    res.json({
        success: true,
        message: 'OK',
        data: { apiKeys: result }
    });
});

// ------------------------------------------------------------
// PATCH /api/api-keys/:id/revoke
// ------------------------------------------------------------
const revokeApiKey = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };

    const result = await apiKeysService.revokeApiKey(
        req.user.companyId,
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'API key revoked',
        data: { apiKey: result }
    });
});

// ------------------------------------------------------------
// DELETE /api/api-keys/:id
// ------------------------------------------------------------
const deleteApiKey = catchAsync(async (req, res) => {
    const reqInfo = { ip: req.ip, userAgent: req.get('user-agent') };

    await apiKeysService.deleteApiKey(
        req.user.companyId,
        req.params.id,
        req.user,
        reqInfo
    );

    res.json({
        success: true,
        message: 'API key deleted'
    });
});

// ------------------------------------------------------------
// GET /api/api-keys/all (admin)
// ------------------------------------------------------------
const listAllApiKeys = catchAsync(async (req, res) => {
    const result = await apiKeysService.listAllApiKeys(req.validated.query);

    res.json({
        success: true,
        message: 'OK',
        data: {
            apiKeys: result.items,
            pagination: result.pagination
        }
    });
});

module.exports = {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    deleteApiKey,
    listAllApiKeys
};