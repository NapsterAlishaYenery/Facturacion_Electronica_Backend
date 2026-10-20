// ============================================================
// Servicio de API Keys (FASE 18.1)
// ============================================================
//
// Reglas de negocio:
//   - Solo empresas con plan enterprise (features.api_access) pueden
//     crear keys. System owner tiene bypass.
//   - Límite: MAX_ACTIVE_KEYS_PER_COMPANY keys activas por empresa.
//   - Secret generado con prefijo pk_live_/pk_test_ según company.dgiiEnvironment.
//   - Hash SHA-256 del secret. NUNCA se guarda el secret en claro.
//   - Secret en claro se devuelve UNA SOLA VEZ al crear.
//   - Soft revoke (isActive: false + revokedAt). No hay hard delete.
//   - Audit log en cada creación y revocación.
// ============================================================

const crypto = require('crypto');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
    Company,
    User,
    ApiKey,
    Subscription,
    Plan,
    AuditLog
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');
const {
    MAX_ACTIVE_KEYS_PER_COMPANY,
    PREFIX_LIVE,
    PREFIX_TEST,
    SECRET_BYTES,
    PREFIX_VISIBLE_CHARS
} = require('../../constants/apiKeys');

// ------------------------------------------------------------
// Helper: generar secret + hash + prefix
// Devuelve { secret, keyHash, keyPrefix }
// ------------------------------------------------------------
function generateSecret(environment) {
    const prefix = environment === 'production' ? PREFIX_LIVE : PREFIX_TEST;
    const randomPart = crypto.randomBytes(SECRET_BYTES).toString('hex');

    const secret = prefix + randomPart;
    const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
    const keyPrefix = secret.substring(0, prefix.length + PREFIX_VISIBLE_CHARS);

    return { secret, keyHash, keyPrefix };
}

// ------------------------------------------------------------
// Helper: verificar que la empresa puede usar API access
// (plan enterprise o system owner)
// ------------------------------------------------------------
async function assertApiAccessAllowed(companyId) {
    const company = await Company.findByPk(companyId, {
        attributes: ['id', 'isActive', 'isSystemOwner']
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
    if (!company.isActive) {
        throw new AppError(
            'Company is inactive. Cannot create API keys.',
            403,
            'COMPANY_INACTIVE'
        );
    }

    // System owner tiene bypass (igual que createMyInvoice)
    if (company.isSystemOwner) {
        return company;
    }

    // Buscar suscripción activa (trial / active / past_due)
    const subscription = await Subscription.findOne({
        where: {
            companyId,
            status: { [Op.in]: ['trial', 'active', 'past_due'] }
        },
        include: [{ model: Plan, as: 'plan', required: true }],
        order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
        throw new AppError(
            'No active subscription found',
            403,
            'NO_ACTIVE_SUBSCRIPTION'
        );
    }

    const apiAccessEnabled = subscription.plan?.features?.api_access === true;
    if (!apiAccessEnabled) {
        throw new AppError(
            `API access is not included in the "${subscription.plan.name}" plan. Upgrade to enterprise to use API keys.`,
            403,
            'API_ACCESS_NOT_IN_PLAN'
        );
    }

    return company;
}

// ------------------------------------------------------------
// Helper: contar keys activas de la empresa
// ------------------------------------------------------------
async function countActiveKeys(companyId, transaction = null) {
    return ApiKey.count({
        where: { companyId, isActive: true },
        transaction
    });
}

// ------------------------------------------------------------
// Crear API Key
// ------------------------------------------------------------
async function createApiKey(companyId, data, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Verificar plan (features.api_access)
    const company = await assertApiAccessAllowed(companyId);

    // 2. Generar secret + hash + prefix
    const environment = company.dgiiEnvironment || 'testecf';
    const { secret, keyHash, keyPrefix } = generateSecret(environment);

    // 3. Calcular expiresAt si viene expiresInDays
    let expiresAt = null;
    if (data.expiresInDays) {
        expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);
    }

    // 4. Crear en transacción (con check de límite dentro de la tx
    //    para evitar race conditions con requests concurrentes)
    const apiKey = await sequelize.transaction(async (t) => {
        const activeCount = await countActiveKeys(companyId, t);
        if (activeCount >= MAX_ACTIVE_KEYS_PER_COMPANY) {
            throw new AppError(
                `Maximum number of active API keys reached (${activeCount}/${MAX_ACTIVE_KEYS_PER_COMPANY}). Revoke an existing key to create a new one.`,
                409,
                'MAX_API_KEYS_REACHED'
            );
        }

        const created = await ApiKey.create({
            companyId,
            name: data.name,
            keyHash,
            keyPrefix,
            environment,
            isActive: true,
            expiresAt,
            createdBy: reqUser?.id ?? null
        }, { transaction: t });

        // 5. Audit log (NUNCA incluir secret ni keyHash)
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'api_key.created',
                entity: 'api_key',
                entityId: created.id,
                after: {
                    name: created.name,
                    keyPrefix: created.keyPrefix,
                    environment: created.environment,
                    expiresAt: created.expiresAt
                },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Audit best-effort: no romper la creación
            console.error('[api-keys.service] audit log (create) failed:', err.message);
        }

        return created;
    });

    // 6. Devolver secret EN CLARO una sola vez
    return {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        environment: apiKey.environment,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        secret // ← solo aquí, nunca más
    };
}

// ------------------------------------------------------------
// Listar API Keys de la empresa
// ------------------------------------------------------------
async function listApiKeys(companyId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const keys = await ApiKey.findAll({
        where: { companyId },
        attributes: [
            'id', 'name', 'keyPrefix', 'environment',
            'lastUsedAt', 'expiresAt', 'isActive', 'revokedAt',
            'createdBy', 'createdAt'
        ],
        order: [['createdAt', 'DESC']]
    });

    // Enriquecer con un campo "expired" calculado (útil para el frontend)
    return keys.map(k => {
        const json = k.toJSON();
        json.expired = json.expiresAt
            ? new Date(json.expiresAt) <= new Date()
            : false;
        return json;
    });
}

// ------------------------------------------------------------
// Revocar API Key (soft revoke)
// ------------------------------------------------------------
async function revokeApiKey(companyId, apiKeyId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const apiKey = await ApiKey.findOne({
        where: { id: apiKeyId, companyId }
    });

    if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    if (!apiKey.isActive) {
        throw new AppError(
            'API key is already revoked',
            409,
            'API_KEY_ALREADY_REVOKED'
        );
    }

    const revokedAt = new Date();

    await sequelize.transaction(async (t) => {
        await apiKey.update(
            { isActive: false, revokedAt },
            { transaction: t }
        );

        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'api_key.revoked',
                entity: 'api_key',
                entityId: apiKey.id,
                before: { isActive: true },
                after: { isActive: false, revokedAt },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            console.error('[api-keys.service] audit log (revoke) failed:', err.message);
        }
    });

    return {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        revokedAt
    };
}

module.exports = {
    createApiKey,
    listApiKeys,
    revokeApiKey,
    _helpers: {
        generateSecret,
        assertApiAccessAllowed,
        countActiveKeys
    }
};