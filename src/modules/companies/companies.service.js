// ============================================================
// Servicio de empresas
// Contiene TODA la lógica de negocio del módulo companies
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { Company, User, Subscription, Plan, Sequence, Invoice, AuditLog } = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const cryptoUtil = require('../../shared/utils/crypto');


// ------------------------------------------------------------
// Helpers del módulo (solo para certificados)
// ------------------------------------------------------------

// Normaliza RNC quitando todo lo que no sea dígito
function normalizeRnc(value) {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
}

// Extrae el RNC del certificado X.509 con 3 estrategias
function extractRncFromCert(cert) {
    // Estrategia 1: serialNumber (el más común en Viafirma)
    const serial = normalizeRnc(cert.serialNumber);
    if (serial && (serial.length === 9 || serial.length === 11)) {
        return serial;
    }

    // Estrategia 2: commonName (regex sobre el CN)
    const cnAttr = cert.subject.getField('CN');
    if (cnAttr && cnAttr.value) {
        // Buscar 9 u 11 dígitos seguidos (ignorando guiones)
        const cnDigits = normalizeRnc(cnAttr.value);
        if (cnDigits && (cnDigits.length === 9 || cnDigits.length === 11)) {
            return cnDigits;
        }
    }

    // Estrategia 3: subjectAltName (raro pero posible)
    const sanExt = cert.getExtension('subjectAltName');
    if (sanExt && Array.isArray(sanExt.altNames)) {
        for (const alt of sanExt.altNames) {
            if (alt.value) {
                const altDigits = normalizeRnc(alt.value);
                if (altDigits && (altDigits.length === 9 || altDigits.length === 11)) {
                    return altDigits;
                }
            }
        }
    }

    return null;
}

// Extrae el certificado X.509 de un PKCS#12 abierto
function extractCertFromP12(p12Asn1) {
    const certBags = p12Asn1.getBags({ bagType: forge.pki.oids.certBag });
    const bag = certBags[forge.pki.oids.certBag];
    if (!bag || !bag[0] || !bag[0].cert) {
        return null;
    }
    return bag[0].cert;
}




// ------------------------------------------------------------
// Obtener mi empresa (con suscripción, plan y conteos)
// ------------------------------------------------------------
async function getMyCompany(companyId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company. Admins must use GET /api/companies/:id',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [
            {
                model: Subscription,
                as: 'subscriptions',
                where: { status: ['trial', 'active', 'past_due'] },
                required: false,
                limit: 1,
                order: [['createdAt', 'DESC']],
                include: [{
                    model: Plan,
                    as: 'plan',
                    attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth', 'maxUsers', 'maxSequences', 'features']
                }]
            }
        ]
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Contar usuarios activos
    const usersCount = await User.count({
        where: { companyId, isActive: true }
    });

    // 3. Contar secuencias activas
    const sequencesCount = await Sequence.count({
        where: { companyId, isActive: true }
    });

    // 4. Extraer la suscripción (viene como array por el hasMany)
    const subscriptions = company.subscriptions || [];
    const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // 5. Construir la respuesta
    const companyData = company.toJSON();
    delete companyData.subscriptions; // Limpiar el array crudo

    return {
        company: companyData,
        subscription: currentSubscription,
        plan: currentSubscription?.plan || null,
        stats: {
            usersCount,
            sequencesCount
        }
    };
}

// ------------------------------------------------------------
// Actualizar mi empresa
// ------------------------------------------------------------
async function updateMyCompany(companyId, updates, reqUser, reqInfo = {}) {
    // 1. Verificar que el usuario tenga empresa
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 2. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 3. Verificar que esté activa (no se puede editar una suspendida)
    if (!company.isActive) {
        throw new AppError('Company is inactive', 403, 'COMPANY_INACTIVE');
    }

    // 4. Guardar estado anterior para audit (solo campos editables)
    const before = {
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        phone: company.phone,
        address: company.address,
        economicActivity: company.economicActivity
    };

    // 5. Filtrar campos permitidos (doble protección)
    const allowedFields = ['name', 'tradeName', 'email', 'phone', 'address', 'economicActivity'];
    const updateData = {};
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateData[field] = updates[field];
        }
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    // 6. Actualizar
    await company.update(updateData);

    // 7. Audit log
    try {
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action: 'company.updated',
            entity: 'company',
            entityId: company.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return company;
}

// ------------------------------------------------------------
// Listar TODAS las empresas (solo admin)
// ------------------------------------------------------------
async function listCompanies(filters = {}) {
    const where = {};

    // Filtros opcionales
    if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
    }

    if (filters.dgiiEnvironment) {
        where.dgiiEnvironment = filters.dgiiEnvironment;
    }

    // Búsqueda por RNC o nombre (case-insensitive)
    if (filters.search) {
        where[Op.or] = [
            { rnc: { [Op.iLike]: `%${filters.search}%` } },
            { name: { [Op.iLike]: `%${filters.search}%` } },
            { tradeName: { [Op.iLike]: `%${filters.search}%` } }
        ];
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Query con conteo
    const { count, rows } = await Company.findAndCountAll({
        where,
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [{
            model: Subscription,
            as: 'subscriptions',
            where: { status: ['trial', 'active', 'past_due'] },
            required: false,
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Plan,
                as: 'plan',
                attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth']
            }]
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true  // Necesario con includes para contar correctamente
    });

    const totalPages = Math.ceil(count / limit);

    // Normalizar la respuesta (quitar el array crudo de subscriptions)
    const companies = rows.map((company) => {
        const data = company.toJSON();
        const subscriptions = data.subscriptions || [];
        const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

        delete data.subscriptions;

        return {
            ...data,
            subscription: currentSubscription,
            plan: currentSubscription?.plan || null
        };
    });

    return {
        items: companies,
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
// Ver una empresa específica (solo admin)
// ------------------------------------------------------------
async function getCompanyById(companyId) {
    // 1. Buscar la empresa con sus relaciones
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        },
        include: [{
            model: Subscription,
            as: 'subscriptions',
            where: { status: ['trial', 'active', 'past_due'] },
            required: false,
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Plan,
                as: 'plan',
                attributes: ['id', 'code', 'name', 'priceDop', 'priceUsd', 'invoicesPerMonth', 'maxUsers', 'maxSequences', 'features']
            }]
        }]
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Contar usuarios activos
    const usersCount = await User.count({
        where: { companyId, isActive: true }
    });

    // 3. Contar secuencias activas
    const sequencesCount = await Sequence.count({
        where: { companyId, isActive: true }
    });

    // 4. Extraer la suscripción actual
    const subscriptions = company.subscriptions || [];
    const currentSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // 5. Construir la respuesta
    const companyData = company.toJSON();
    delete companyData.subscriptions;

    return {
        company: companyData,
        subscription: currentSubscription,
        plan: currentSubscription?.plan || null,
        stats: {
            usersCount,
            sequencesCount
        }
    };
}

// ------------------------------------------------------------
// Actualizar cualquier empresa (solo admin)
// ------------------------------------------------------------
async function updateCompanyById(companyId, updates, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId);
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Guardar estado anterior para audit
    const before = {
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        phone: company.phone,
        address: company.address,
        economicActivity: company.economicActivity,
        dgiiEnvironment: company.dgiiEnvironment,
        isActive: company.isActive
    };

    // 3. Filtrar campos permitidos (doble protección)
    const allowedFields = [
        'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity',
        'dgiiEnvironment', 'isActive'
    ];
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
    await company.update(updateData);

    const safeCompany = await Company.findByPk(company.id, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    // 5. Audit log
    try {
        await AuditLog.create({
            companyId: safeCompany.id,
            userId: reqUser.id,
            action: 'company.updated_by_admin',
            entity: 'company',
            entityId: safeCompany.id,
            before,
            after: updateData,
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return safeCompany;
}

// ------------------------------------------------------------
// Activar/desactivar empresa (solo admin)
// ------------------------------------------------------------
async function toggleCompanyActive(companyId, isActive, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Idempotencia: si ya está en el estado deseado, no hacer nada
    //    (pero sí retornar la empresa por consistencia)
    if (company.isActive === isActive) {
        return company;
    }

    // 3. Guardar estado anterior
    const before = {
        isActive: company.isActive
    };

    // 4. Actualizar
    await company.update({ isActive });

    // 5. Audit log con acción específica
    const action = isActive ? 'company.activated' : 'company.deactivated';
    try {
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action,
            entity: 'company',
            entityId: company.id,
            before,
            after: { isActive },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    return company;
}

// ------------------------------------------------------------
// Borrar empresa (solo admin, hard delete)
// ------------------------------------------------------------
async function deleteCompany(companyId, reqUser, reqInfo = {}) {
    // 1. Buscar la empresa
    const company = await Company.findByPk(companyId, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag'
            ]
        }
    });

    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    // 2. Verificar que NO tenga facturas emitidas
    const invoicesCount = await Invoice.count({
        where: { companyId }
    });

    if (invoicesCount > 0) {
        throw new AppError(
            `Cannot delete company with ${invoicesCount} issued invoice(s). Deactivate it instead using PATCH /api/companies/${companyId}/activate with { isActive: false }.`,
            409,
            'COMPANY_HAS_INVOICES'
        );
    }

    // 3. Guardar datos para audit
    const before = {
        id: company.id,
        rnc: company.rnc,
        name: company.name,
        tradeName: company.tradeName,
        email: company.email,
        isActive: company.isActive,
        dgiiEnvironment: company.dgiiEnvironment
    };

    // 4. Borrar en transacción
    await sequelize.transaction(async (t) => {
        const usersCount = await User.count({ where: { companyId }, transaction: t });
        const sequencesCount = await Sequence.count({ where: { companyId }, transaction: t });
        const subscriptionsCount = await Subscription.count({ where: { companyId }, transaction: t });

        // Audit log ANTES del destroy
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action: 'company.deleted',
            entity: 'company',
            entityId: company.id,
            before,
            after: {
                deleted: true,
                stats: {
                    usersCount,
                    sequencesCount,
                    subscriptionsCount
                }
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        }, { transaction: t });

        // Destroy con cascade
        await company.destroy({ transaction: t });
    });

    return {
        deleted: true,
        before,
        cascadeDeleted: {
            users: true,
            subscriptions: true,
            sequences: true
        }
    };
}

// ------------------------------------------------------------
// Subir certificado digital .p12 cifrado con AES-256-GCM
// ------------------------------------------------------------
async function uploadCertificate(companyId, fileBuffer, password, reqUser, reqInfo = {}) {
    // 1. Verificar empresa
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    if (!company.isActive) {
        throw new AppError('Company is inactive', 403, 'COMPANY_INACTIVE');
    }

    // 2. Abrir el .p12 con node-forge
    let p12Asn1;
    try {
        const derBuffer = fileBuffer.toString('binary');
        p12Asn1 = forge.pkcs12.pkcs12FromAsn1(
            forge.asn1.fromDer(derBuffer),
            password
        );
    } catch (err) {
        throw new AppError(
            'Invalid certificate password or corrupted .p12 file',
            400,
            'CERTIFICATE_INVALID_PASSWORD'
        );
    }

    // 3. Extraer el certificado X.509
    const cert = extractCertFromP12(p12Asn1);
    if (!cert) {
        throw new AppError(
            'No X.509 certificate found in the .p12 file',
            400,
            'CERTIFICATE_NO_X509'
        );
    }

    // 4. Extraer RNC
    const certRnc = extractRncFromCert(cert);
    if (!certRnc) {
        throw new AppError(
            'Could not extract RNC from certificate. Expected 9 or 11 digits in serialNumber, CN or subjectAltName.',
            400,
            'CERTIFICATE_RNC_NOT_FOUND'
        );
    }

    // 5. Comparar RNC con el de la empresa (normalizado)
    const companyRnc = normalizeRnc(company.rnc);
    if (certRnc !== companyRnc) {
        throw new AppError(
            `Certificate RNC (${certRnc}) does not match company RNC (${companyRnc})`,
            400,
            'CERTIFICATE_RNC_MISMATCH'
        );
    }

    // 6. Verificar expiración
    const expiresAt = cert.validity.notAfter;
    if (expiresAt < new Date()) {
        throw new AppError(
            `Certificate expired on ${expiresAt.toISOString()}`,
            400,
            'CERTIFICATE_EXPIRED'
        );
    }

    // 7. Cifrar el .p12
    const { encrypted, iv, authTag } = cryptoUtil.encryptBuffer(fileBuffer);

    // 8. Asegurar que exista el directorio y escribir el archivo
    const uploadDir = process.env.CERT_UPLOAD_DIR || './uploads/certs';
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${companyId}.p12.enc`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, encrypted);

    // 9. Cifrar el password
    const certificatePasswordEncrypted = cryptoUtil.encryptString(password);

    // 10. Actualizar la empresa (6 campos)
    const before = {
        hasCertificate: !!company.certificatePath,
        certificateExpiresAt: company.certificateExpiresAt
    };

    await company.update({
        certificatePath: filename,
        certificateIv: iv.toString('base64'),
        certificateAuthTag: authTag.toString('base64'),
        certificatePasswordEncrypted,
        certificateUploadedAt: new Date(),
        certificateExpiresAt: expiresAt
    });

    // 11. Audit log
    try {
        await AuditLog.create({
            companyId: company.id,
            userId: reqUser.id,
            action: 'company.certificate_uploaded',
            entity: 'company',
            entityId: company.id,
            before,
            after: {
                hasCertificate: true,
                certificateExpiresAt: expiresAt,
                certificateRnc: certRnc
            },
            ip: reqInfo.ip || null,
            userAgent: reqInfo.userAgent || null
        });
    } catch (err) {
        // Ignorar errores de audit
    }

    // 12. Devolver la empresa SIN campos sensibles
    const safeCompany = await Company.findByPk(company.id, {
        attributes: {
            exclude: [
                'certificatePasswordEncrypted',
                'certificateIv',
                'certificateAuthTag',
                'certificatePath'
            ]
        }
    });

    return safeCompany;
}

module.exports = {
    getMyCompany,
    updateMyCompany,
    listCompanies,
    getCompanyById,
    updateCompanyById,
    toggleCompanyActive,
    deleteCompany,
    uploadCertificate
};