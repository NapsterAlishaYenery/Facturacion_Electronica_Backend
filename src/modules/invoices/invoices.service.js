// ============================================================
// Servicio de facturas
// Pendiente: agregar funciones cuando se implementen los endpoints
// ============================================================

const { Op } = require('sequelize');
const notifications = require('../notifications');
const notificationsConfig = require('../../config/notifications');
const { assertSubscriptionCanUse } = require('../../shared/utils/subscription.helpers');
const sequelize = require('../../config/database');
const {
    Company,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// LISTA DE METODOS HELPERS

// Helper: nombre legible del tipo de e-CF
// ------------------------------------------------------------
const ECF_TYPE_NAMES = {
    '31': 'Factura de Crédito Fiscal Electrónica',
    '32': 'Factura de Consumo Electrónica',
    '33': 'Nota de Débito Electrónica',
    '34': 'Nota de Crédito Electrónica',
    '41': 'Comprobante de Compras Electrónico',
    '43': 'Gastos Menores Electrónico',
    '44': 'Regímenes Especiales Electrónico',
    '45': 'Gubernamental Electrónico',
    '46': 'Comprobante de Exportaciones Electrónico',
    '47': 'Comprobante para Pagos al Exterior Electrónico'
};

// ------------------------------------------------------------
// Helper: mapear <Transporte> del payload a columnas planas
// Devuelve {} si no aplica (el Joi ya filtró por tipo)
// ------------------------------------------------------------
function mapTransporteFields(transporte) {
    if (!transporte) return {};

    return {
        transporteVia: transporte.viaTransporte || null,
        transportePaisOrigen: transporte.paisOrigen || null,
        transporteDireccionDestino: transporte.direccionDestino || null,
        transportePaisDestino: transporte.paisDestino || null,
        transporteRncCompania: transporte.rncCompaniaTransportista || null,
        transporteNombreCompania: transporte.nombreCompaniaTransportista || null,
        transporteNumeroViaje: transporte.numeroViaje || null,
        transporteConductor: transporte.conductor || null,
        transporteDocumento: transporte.documentoTransporte || null,
        transporteFicha: transporte.ficha || null,
        transportePlaca: transporte.placa || null,
        transporteRuta: transporte.rutaTransporte || null,
        transporteZona: transporte.zonaTransporte || null,
        transporteNumeroAlbaran: transporte.numeroAlbaran || null
    };
}

// ------------------------------------------------------------
// Helper: mapear <InformacionesAdicionales> del payload a columnas
// planas. Solo aplica a tipo 46 (exportación).
// ------------------------------------------------------------
function mapInfoAdicionalFields(info) {
    if (!info) return {};

    return {
        infoFechaEmbarque: info.fechaEmbarque ? new Date(info.fechaEmbarque) : null,
        infoNumeroEmbarque: info.numeroEmbarque || null,
        infoNumeroContenedor: info.numeroContenedor || null,
        infoNombrePuertoEmbarque: info.nombrePuertoEmbarque || null,
        infoCondicionesEntrega: info.condicionesEntrega || null,
        infoTotalFob: info.totalFob ?? null,
        infoSeguro: info.seguro ?? null,
        infoFlete: info.flete ?? null,
        infoOtrosGastos: info.otrosGastos ?? null,
        infoTotalCif: info.totalCif ?? null,
        infoRegimenAduanero: info.regimenAduanero || null,
        infoNombrePuertoSalida: info.nombrePuertoSalida || null,
        infoNombrePuertoDesembarque: info.nombrePuertoDesembarque || null
    };
}


// ------------------------------------------------------------
// Helper: validar y cargar la factura original que modifica
// una Nota de Débito/Crédito (33/34)
// TRANSACCIONAL — se llama dentro de la tx para bloquear la fila
// ------------------------------------------------------------
async function resolveModifiedInvoice(companyId, type, modifiedNcf, transaction) {
    // 1. Solo los tipos 33 y 34 requieren este paso
    if (type !== '33' && type !== '34') return null;

    // 2. Buscar la factura original por NCF en la misma empresa (sin filtrar status todavía)
    const original = await Invoice.findOne({
        where: {
            companyId,
            ncf: modifiedNcf
        },
        transaction
    });

    if (!original) {
        throw new AppError(
            `Original invoice with NCF ${modifiedNcf} not found`,
            404,
            'ORIGINAL_INVOICE_NOT_FOUND'
        );
    }

    // 3. La original debe estar emitida (sent o accepted), nunca draft
    if (original.status !== 'sent' && original.status !== 'accepted') {
        throw new AppError(
            `Cannot modify an invoice with status '${original.status}'. It must be sent or accepted.`,
            409,
            'ORIGINAL_NOT_EMITTED'
        );
    }

    // 4. La original debe ser 31 o 32 (no se modifica un 33/34 con otro 33/34)
    if (original.type !== '31' && original.type !== '32') {
        throw new AppError(
            `Cannot reference an invoice of type ${original.type}. Only 31 or 32 can be modified.`,
            409,
            'INVALID_ORIGINAL_TYPE'
        );
    }

    // 5. No debe existir ya una nota ACTIVA que modifique la misma factura
    const existingNote = await Invoice.findOne({
        where: {
            companyId,
            modifiedNcf,
            type: { [Op.in]: ['33', '34'] },
            status: { [Op.notIn]: ['rejected'] }
        },
        transaction
    });

    if (existingNote) {
        throw new AppError(
            `Invoice ${modifiedNcf} already has an active note (${existingNote.ncf})`,
            409,
            'ORIGINAL_ALREADY_MODIFIED'
        );
    }

    return original;
}

// ------------------------------------------------------------
// Helper: construir la respuesta completa de una factura
// con campos calculados
// ------------------------------------------------------------
function buildInvoiceResponse(invoice, options = {}) {
    const { lineCount = null } = options;

    const data = typeof invoice.toJSON === 'function' ? invoice.toJSON() : invoice;

    const status = data.status;
    const type = data.type;

    // 🔥 NUEVO: flags por tipo
    const isNota = type === '33' || type === '34';

    const response = {
        ...data,

        // Estado
        isDraft: status === 'draft',
        isSigned: status === 'signed',
        isSent: status === 'sent',
        isAccepted: status === 'accepted',
        isRejected: status === 'rejected',
        isContingency: status === 'contingency',

        // Permisos
        canEdit: status === 'draft',
        canDelete: status === 'draft',
        canBeSigned: status === 'draft',
        canBeSent: status === 'signed',
        hasTrackId: !!data.trackId,

        // 🔥 NUEVO: identificación por tipo
        typeName: ECF_TYPE_NAMES[type] || null,
        isNota,
        isDebitNote: type === '33',
        isCreditNote: type === '34',
        hasModificationReference: isNota && !!data.modifiedNcf,
        canEditReference: false   // los campos de referencia nunca se editan
    };

    // lineCount solo si se pasa explícitamente (viene de un COUNT)
    if (lineCount !== null) {
        response.lineCount = lineCount;
    }

    // Ocultar xmlContent y xmlSigned en listados (son pesados)
    // Se devuelven solo en el detalle individual
    if (options.hideXml !== false) {
        delete response.xmlContent;
        delete response.xmlSigned;
    }

    return { invoice: response };
}

// ------------------------------------------------------------
// Helper: calcular totales de una línea de factura
// ------------------------------------------------------------
function calculateLineTotals(item) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discount = Number(item.discount || 0);

    // Resolver indicadorFacturacion (si viene explícito, se respeta;
    // si no, se infiere de itbisRate con backward-compat).
    let indicador = item.indicadorFacturacion;
    if (indicador === undefined || indicador === null) {
        const rate = Number(item.itbisRate ?? 18);
        if (rate === 18) indicador = 1;
        else if (rate === 16) indicador = 2;
        else if (rate === 0) indicador = 4; // default: exento
        else indicador = 4;
    }
    indicador = Number(indicador);

    // Tasa efectiva según indicador
    const itbisRate = InvoiceLine.getRateFromIndicador(indicador);

    // Base = (cantidad × precio) - descuento
    const lineBase = (quantity * unitPrice) - discount;

    // ITBIS = base × (tasa / 100)
    const itbisAmount = lineBase * (itbisRate / 100);

    // Total de la línea = base + ITBIS
    const total = Math.round((lineBase + itbisAmount) * 100) / 100;

    return {
        quantity,
        unitPrice,
        discount,
        itbisRate,
        indicadorFacturacion: indicador,
        lineBase: Math.round(lineBase * 100) / 100,
        itbisAmount: Math.round(itbisAmount * 100) / 100,
        total
    };
}

// ------------------------------------------------------------
// Helper: calcular totales de la factura completa
// ------------------------------------------------------------
function calculateInvoiceTotals(lines) {
    let itbis1Base = 0, itbis1Amount = 0;
    let itbis2Base = 0, itbis2Amount = 0;
    let itbis3Base = 0, itbis3Amount = 0;
    let exemptAmount = 0;
    let total = 0;

    for (const line of lines) {
        const ind = Number(line.indicadorFacturacion);
        const base = Number(line.lineBase);
        const amount = Number(line.itbisAmount);

        if (ind === 1) {
            itbis1Base += base;
            itbis1Amount += amount;
        } else if (ind === 2) {
            itbis2Base += base;
            itbis2Amount += amount;
        } else if (ind === 3) {
            itbis3Base += base;
            itbis3Amount += amount;
        } else if (ind === 4) {
            exemptAmount += base;
        }
        // ind === 0 (No Facturable) → no suma a ninguna base

        total += Number(line.total);
    }

    const round = (n) => Math.round(n * 100) / 100;

    const montoGravado = round(itbis1Base + itbis2Base + itbis3Base);
    const itbis = round(itbis1Amount + itbis2Amount + itbis3Amount);

    // Backward-compat: 'subtotal' sigue existiendo y significa
    // la suma de TODAS las bases (gravadas + exentas), como antes.
    const subtotal = round(montoGravado + exemptAmount);

    return {
        // Campos nuevos (correctos fiscalmente)
        montoGravado,
        itbis1Base: round(itbis1Base),
        itbis1Amount: round(itbis1Amount),
        itbis2Base: round(itbis2Base),
        itbis2Amount: round(itbis2Amount),
        itbis3Base: round(itbis3Base),
        itbis3Amount: round(itbis3Amount),
        exemptAmount: round(exemptAmount),

        // Campos heredados (mantener por backward-compat)
        subtotal,
        itbis,
        total: round(total)
    };
}

// ------------------------------------------------------------
// Notificar al dueño cuando no se encuentra secuencia válida.
// Fire-and-forget: no bloquea la transacción ni el throw.
//
// Deduplicación: si el mismo user ya intentó el mismo tipo en
// las últimas 2 horas, NO se vuelve a enviar.
// ------------------------------------------------------------
async function notifyNoActiveSequence(companyId, type, reqUser) {
    // Sin reqUser no hay a quién notificar con contexto
    if (!reqUser || !reqUser.id) return;

    try {
        // 1. Deduplicar: buscar intento reciente en AuditLog
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const recent = await AuditLog.findOne({
            where: {
                userId: reqUser?.id ?? null,
                action: 'invoice.no_active_sequence_attempt',
                createdAt: { [Op.gte]: twoHoursAgo }
            },
            order: [['createdAt', 'DESC']]
        });

        // Si ya intentó el mismo tipo recientemente, no reenviar
        if (recent && recent.after && recent.after.type === type) {
            return;
        }

        // 2. Cargar empresa + owner
        const company = await Company.findByPk(companyId, {
            attributes: ['id', 'rnc', 'name', 'email']
        });

        if (!company) return;

        // 3. Destinatarios: el user que intentó + company.email
        const bcc = notificationsConfig.alerts.registrationNotifyEmail || undefined;
        const recipients = new Set();
        if (reqUser.email) recipients.add(reqUser.email);
        if (company.email) recipients.add(company.email);

        // 4. Nombre legible del tipo
        const typeName = ECF_TYPE_NAMES[String(type)] || null;

        // 5. Enviar a cada destinatario
        for (const to of recipients) {
            try {
                await notifications.sendNoActiveSequence({
                    to,
                    bcc,
                    companyName: company.name,
                    rnc: company.rnc,
                    ownerName: reqUser.firstName || null,
                    type,
                    typeName,
                    attemptedAt: new Date()
                });
            } catch (err) {
                console.error('[invoices.notifyNoActiveSequence] Send failed:', err.message);
            }
        }

        // 6. Registrar intento para deduplicar futuros avisos
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.no_active_sequence_attempt',
                entity: 'invoice',
                entityId: null,
                after: { type },
                ip: null,
                userAgent: null
            });
        } catch (err) {
            // Ignorar errores de audit — la notificación ya se envió
        }

    } catch (err) {
        // Nunca debe romper el flujo principal
        console.error('[invoices.notifyNoActiveSequence] Unexpected error:', err.message);
    }
}

// ------------------------------------------------------------
// Helper: asignar el siguiente e-NCF desde una secuencia activa
// TRANSACCIONAL — debe llamarse dentro de sequelize.transaction
// ------------------------------------------------------------
async function assignNextNCF(companyId, type, transaction, reqUser = null) {
    // 1. Buscar la secuencia activa, vigente, con números disponibles, ordenada por vencimiento

    const sequence = await Sequence.findOne({
        where: {
            companyId,
            type,
            isActive: true,
            expiresAt: { [Op.gt]: new Date() },
            currentNumber: { [Op.lt]: sequelize.literal('"Sequence"."end_number"') }
        },
        order: [['expiresAt', 'ASC'], ['createdAt', 'ASC']],
        lock: transaction.LOCK.UPDATE, // ← Lock pesimista
        transaction
    });

    // 2. Si no existe secuencia activa
    if (!sequence) {
        // Fire-and-forget: no await. La transacción va a abortar de todas formas
        // por el throw, así que no queremos bloquear esperando al SMTP.
        notifyNoActiveSequence(companyId, type, reqUser).catch(err => {
            console.error('[invoices.assignNextNCF] Alert dispatch failed:', err.message);
        });

        throw new AppError(
            `No active sequence found for type ${type}. Please register or activate one first.`,
            409,
            'NO_ACTIVE_SEQUENCE'
        );
    }

    // 3. Calcular siguiente número
    const currentNumber = Number(sequence.currentNumber);
    const endNumber = Number(sequence.endNumber);
    const nextNumber = currentNumber + 1;

    // 4. Verificar que no se haya agotado
    if (nextNumber > endNumber) {
        throw new AppError(
            `Sequence ${sequence.prefix}${sequence.type} is exhausted (reached ${endNumber})`,
            409,
            'SEQUENCE_EXHAUSTED'
        );
    }

    // 5. Actualizar currentNumber
    const willBeExhausted = nextNumber === endNumber;

    await sequence.update(
        {
            currentNumber: nextNumber,
            ...(willBeExhausted && { isActive: false })
        },
        { transaction }
    );

    // 6. Construir el e-NCF completo
    const { buildNCF } = require('../../shared/utils/ncf');
    const ncf = buildNCF(sequence.prefix, sequence.type, nextNumber);

    return { sequence, ncf, nextNumber };
}



// LISTA DE METODOS DEL SERVICIO 

// ------------------------------------------------------------
// Listar MIS facturas (company_admin)
// ------------------------------------------------------------
async function listMyInvoices(companyId, filters = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // Construir where
    const where = { companyId };

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.receiverRnc) {
        where.receiverRnc = filters.receiverRnc;
    }

    if (filters.ncf) {
        where.ncf = filters.ncf;
    }

    // Filtro por fecha de emisión
    if (filters.fromDate || filters.toDate) {
        where.issuedAt = {};
        if (filters.fromDate) {
            where.issuedAt[Op.gte] = filters.fromDate;
        }
        if (filters.toDate) {
            where.issuedAt[Op.lte] = filters.toDate;
        }
    }

    // Filtro por hasTrackId
    if (filters.hasTrackId !== undefined) {
        if (filters.hasTrackId === true) {
            where.trackId = { [Op.ne]: null };
        } else {
            where.trackId = { [Op.eq]: null };
        }
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Query con include de sequence
    const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [{
            model: Sequence,
            as: 'sequence',
            attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber']
        }],
        order: [['issuedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    // Para cada factura, contar sus líneas
    const invoiceIds = rows.map(r => r.id);
    let lineCounts = {};

    if (invoiceIds.length > 0) {
        const counts = await InvoiceLine.findAll({
            attributes: [
                'invoiceId',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: { invoiceId: { [Op.in]: invoiceIds } },
            group: ['invoiceId'],
            raw: true
        });
        counts.forEach(c => {
            lineCounts[c.invoiceId] = Number(c.count);
        });
    }

    // Enriquecer cada factura
    const items = rows.map((inv) => {
        const result = buildInvoiceResponse(inv, { lineCount: lineCounts[inv.id] || 0 });
        return result.invoice;
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items,
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
// Ver una factura específica (company_admin)
// ------------------------------------------------------------
async function getMyInvoiceById(companyId, invoiceId) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la factura con sus relaciones
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        include: [
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,           // ← query separada para poder ordenar
                order: [['lineNumber', 'ASC']]
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Contar líneas (para lineCount)
    const lineCount = invoice.lines?.length || 0;

    // 3. Construir respuesta (SÍ exponer xmlContent y xmlSigned en detalle)
    const result = buildInvoiceResponse(invoice, {
        lineCount,
        hideXml: false  // ← en detalle SÍ mostramos XML
    });

    // 4. Agregar campos específicos del detalle
    const status = invoice.status;

    return result;
}

// ------------------------------------------------------------
// Crear factura (company_admin)
// Maneja los 10 tipos de e-CF. Qué campos extras se guardan
// depende de lo que el Joi haya dejado pasar según el tipo.
// ------------------------------------------------------------
async function createMyInvoice(companyId, data, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const {
        type,
        receiverRnc,
        receiverName,
        issuedAt,
        items,
        // Comprador extranjero (46, 47)
        receiverIdentificadorExtranjero,
        receiverPais,
        // Exento (43, 44, 47)
        exemptAmount,
        // ITBIS3 (46)
        itbis3Base,
        itbis3Amount,
        // Retenciones encabezado (41, 47)
        totalItbisRetenido,
        totalIsrRetencion,
        // Transporte (varios)
        transporte,
        // Info adicional (46)
        informacionesAdicionales,
        // Notas (33, 34)
        modifiedNcf,
        modifiedNcfIssuerRnc,
        modifiedNcfDate,
        modificationCode,
        modificationReason,
        indicadorNotaCredito
    } = data;

    const isNota = type === '33' || type === '34';

    // 🔥 NUEVO: validar emisor (empresa activa + suscripción + límite)
    // El helper salta la validación para el system owner (ExpediNap).

    // 1. Empresa existe y está activa
    const company = await Company.findByPk(companyId);
    if (!company) {
        throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
    if (!company.isActive) {
        throw new AppError(
            'Company is inactive. Cannot issue invoices.',
            403,
            'COMPANY_INACTIVE'
        );
    }



    // Transacción
    const result = await sequelize.transaction(async (t) => {

        // 2. Suscripción + límite (dentro de la tx con lock para
        //    evitar race conditions entre requests concurrentes)
        //    El system owner no tiene suscripción ni consume límite.
        let subscription = null;
        if (!company.isSystemOwner) {
            subscription = await assertSubscriptionCanUse(
                companyId,
                'invoices',
                { transaction: t, lock: true }
            );
        }
        const skipLimitCheck = !subscription;

        // 4.1. Notas (33/34): resolver factura original
        let originalInvoice = null;
        if (isNota) {
            originalInvoice = await resolveModifiedInvoice(companyId, type, modifiedNcf, t);
        }

        // 4.2. Asignar NCF
        const { sequence, ncf } = await assignNextNCF(companyId, type, t, reqUser);

        // 4.3. Calcular líneas
        const calculatedLines = items.map((item, index) => {
            const totals = calculateLineTotals(item);
            return {
                lineNumber: index + 1,
                itemCode: item.itemCode || null,
                description: item.description,
                ...totals,
                // 🔥 NUEVO: preservar retención por línea (41, 47)
                retencion: item.retencion || null
            };
        });

        // 4.4. Totales factura
        const invoiceTotals = calculateInvoiceTotals(calculatedLines);

        // 🔥 Defensa en profundidad (opcional) — el schema Joi ya lo valida
        if (type === '32' && invoiceTotals.total >= 250000 && !receiverRnc) {
            throw new AppError(
                'Type 32 with total >= 250,000 requires receiverRnc (DGII rule)',
                409,
                'DGII_250K_RULE'
            );
        }

        // 4.5. issuedAt
        const finalIssuedAt = issuedAt ? new Date(issuedAt) : new Date();

        // 4.6. Campos de nota
        const notaFields = isNota ? {
            modifiedNcf: originalInvoice.ncf,
            modifiedNcfIssuerRnc: modifiedNcfIssuerRnc || originalInvoice.issuerRnc,
            modifiedNcfDate: new Date(modifiedNcfDate),
            modificationCode,
            modificationReason: modificationReason || null,
            indicadorNotaCredito: type === '34' ? indicadorNotaCredito : null
        } : {};

        // 4.7. Crear factura
        const invoice = await Invoice.create({
            companyId,
            sequenceId: sequence.id,
            type,
            ncf,
            status: 'draft',
            issuerRnc: company.rnc,
            issuerName: company.name,
            receiverRnc: receiverRnc || null,
            receiverName: receiverName || null,

            // Comprador extranjero (46, 47)
            receiverIdentificadorExtranjero: receiverIdentificadorExtranjero || null,
            receiverPais: receiverPais || null,

            // Totales base
            // Totales base
            subtotal: invoiceTotals.subtotal,
            itbis: invoiceTotals.itbis,
            total: invoiceTotals.total,

            // 🔥 NUEVO: desglose fiscal (fix DT-27)
            montoGravado: invoiceTotals.montoGravado,
            itbis1Base: invoiceTotals.itbis1Base,
            itbis1Amount: invoiceTotals.itbis1Amount,
            itbis2Base: invoiceTotals.itbis2Base,
            itbis2Amount: invoiceTotals.itbis2Amount,

            // Exento: SIEMPRE derivado de las líneas (no del body)
            exemptAmount: invoiceTotals.exemptAmount || null,

            // ITBIS3: para tipo 46, se respeta el body; para el resto,
            // se toma de las líneas (aunque solo 46 lo usa).
            itbis3Base: type === '46' ? (itbis3Base ?? invoiceTotals.itbis3Base) : (invoiceTotals.itbis3Base || null),
            itbis3Amount: type === '46' ? (itbis3Amount ?? invoiceTotals.itbis3Amount) : (invoiceTotals.itbis3Amount || null),

            // Retenciones encabezado (41, 47)
            totalItbisRetenido: totalItbisRetenido ?? null,
            totalIsrRetencion: totalIsrRetencion ?? null,

            issuedAt: finalIssuedAt,

            // Transporte + Info adicional
            ...mapTransporteFields(transporte),
            ...mapInfoAdicionalFields(informacionesAdicionales),

            // Notas (33, 34)
            ...notaFields
        }, { transaction: t });

        // 4.8. Crear líneas
        const lines = await InvoiceLine.bulkCreate(
            calculatedLines.map((line) => ({
                invoiceId: invoice.id,
                lineNumber: line.lineNumber,
                itemCode: line.itemCode,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount,
                itbisRate: line.itbisRate,
                itbisAmount: line.itbisAmount,
                indicadorFacturacion: line.indicadorFacturacion,   // 🔥 NUEVO
                total: line.total,
                // 🔥 NUEVO: retención por línea (41, 47)
                retencionIndicador: line.retencion?.indicador ?? null,
                montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
            })),
            { transaction: t, returning: true }
        );

        // 4.8.5. 🔥 Generar y persistir XML
        // No rompemos la factura si el XML falla: xml_content queda null
        // y se puede regenerar con updateMyInvoice o un endpoint manual.
        try {
            const { generateAndSaveInvoiceXML } = require('../documents/xml/xml-integrator');
            await generateAndSaveInvoiceXML(invoice.id, t);
        } catch (xmlErr) {
            console.error('[createMyInvoice] XML generation failed:', xmlErr.message);
        }

        // 4.9. Incrementar contador — SOLO si aplica
        //      (el system owner no consume límite de plan)
        if (!skipLimitCheck && subscription) {
            await subscription.increment('invoicesUsedThisMonth', {
                by: 1,
                transaction: t
            });
        }

        // 4.10. Audit log (con info nueva siempre)
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.created',
                entity: 'invoice',
                entityId: invoice.id,
                after: {
                    ncf: invoice.ncf,
                    type: invoice.type,
                    total: invoice.total,
                    lineCount: lines.length,
                    // Comprador
                    receiverRnc: invoice.receiverRnc || null,
                    receiverIdentificadorExtranjero: invoice.receiverIdentificadorExtranjero || null,
                    // Notas
                    modifiedNcf: invoice.modifiedNcf || null,
                    // Exento / ITBIS3
                    exemptAmount: invoice.exemptAmount || null,
                    itbis3Base: invoice.itbis3Base || null,
                    // Retenciones
                    totalItbisRetenido: invoice.totalItbisRetenido || null,
                    totalIsrRetencion: invoice.totalIsrRetencion || null,
                    // Transporte (solo si aplica)
                    transporteVia: invoice.transporteVia || null,
                    transportePaisDestino: invoice.transportePaisDestino || null
                },
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return { invoice, lines, sequence };
    });

    // 5. Recargar con relaciones
    const fullInvoice = await Invoice.findByPk(result.invoice.id, {
        include: [
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
            }
        ]
    });

    // 6. 🔥 Guardar XML en disco (fire-and-forget)
    //    No bloquea la respuesta. Si falla, la factura ya está en BD.
    if (fullInvoice.xmlContent) {
        const { saveXMLToDisk } = require('../documents/storage/xml-storage');
        saveXMLToDisk(fullInvoice, fullInvoice.xmlContent).catch(err => {
            console.error('[createMyInvoice] saveXMLToDisk failed:', err.message);
        });
    }

    return buildInvoiceResponse(fullInvoice, {
        lineCount: fullInvoice.lines.length,
        hideXml: false
    });
}

// ------------------------------------------------------------
// Editar factura (company_admin)
// Solo si status === 'draft'
// ------------------------------------------------------------
// ------------------------------------------------------------
// Editar factura (company_admin)
// Solo si status === 'draft'.
// Los campos de referencia de Notas (modifiedNcf, etc.) NO se
// pueden modificar — si intentan, la constraint del modelo falla.
// ------------------------------------------------------------
async function updateMyInvoice(companyId, invoiceId, updates, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la factura
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId }
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Solo se puede editar si está en draft
    if (invoice.status !== 'draft') {
        throw new AppError(
            `Cannot edit invoice with status '${invoice.status}'. Only drafts can be edited.`,
            409,
            'INVOICE_NOT_EDITABLE'
        );
    }

    // 🔥 Validaciones de negocio que dependen del TIPO real (vive en BD, no en body)
    //    Joi valida forma; aquí validamos contra el tipo real de la factura.

    // 🔥 NUEVO: indicador 3 (ITBIS3) solo aplica a tipo 46.
    //    Si el usuario manda items con indicador 3 en un tipo distinto, rechazar.
    //    (El schema Joi no puede validar esto porque el `type` no viene en el body.)
    if (updates.items !== undefined && invoice.type !== '46') {
        for (let i = 0; i < updates.items.length; i++) {
            const ind = updates.items[i].indicadorFacturacion;
            if (ind !== undefined && Number(ind) === 3) {
                throw new AppError(
                    `Item ${i + 1}: indicadorFacturacion=3 (ITBIS 0% gravado) solo aplica a tipo 46 (exportaciones). Para 0% usa indicadorFacturacion=4 (exento).`,
                    409,
                    'INDICADOR_3_ONLY_46'
                );
            }
        }
    }


    // A) Retención por línea: solo 41/47, y obligatoria en ellos
    if (updates.items !== undefined) {
        const allowsRetencion = invoice.type === '41' || invoice.type === '47';

        for (let i = 0; i < updates.items.length; i++) {
            const ret = updates.items[i].retencion;
            const hasRetencion = ret !== undefined && ret !== null;

            if (hasRetencion && !allowsRetencion) {
                throw new AppError(
                    `Item ${i + 1}: retencion only applies to types 41 and 47`,
                    409,
                    'RETENCION_NOT_ALLOWED'
                );
            }
            if (allowsRetencion && !hasRetencion) {
                throw new AppError(
                    `Item ${i + 1}: retencion is required for types 41 and 47`,
                    409,
                    'RETENCION_REQUIRED'
                );
            }
        }
    }

    // B) e-CF 32: si el total final >= 250,000 requiere identificación (DGII)
    //    Resolvemos el estado FINAL: items del body o los de BD si no vienen.
    if (invoice.type === '32') {
        // Items finales
        const finalItems = updates.items !== undefined
            ? updates.items
            : await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']]
            });

        // Total final (misma fórmula que el schema Joi)
        const finalTotal = finalItems.reduce((sum, it) => {
            const base = (Number(it.quantity) * Number(it.unitPrice)) - Number(it.discount || 0);
            const itbis = base * (Number(it.itbisRate ?? 18) / 100);
            return sum + base + itbis;
        }, 0);

        // RNC y nombre finales (merge body + BD)
        const finalRnc = updates.receiverRnc !== undefined
            ? updates.receiverRnc
            : invoice.receiverRnc;

        const finalName = updates.receiverName !== undefined
            ? updates.receiverName
            : invoice.receiverName;

        if (finalTotal >= 250000) {
            if (!finalRnc) {
                throw new AppError(
                    `Type 32 with total >= 250,000 requires receiverRnc (DGII rule). Current total: ${finalTotal}`,
                    409,
                    'DGII_250K_RNC_REQUIRED'
                );
            }
            if (!finalName) {
                throw new AppError(
                    `Type 32 with total >= 250,000 requires receiverName (DGII rule). Current total: ${finalTotal}`,
                    409,
                    'DGII_250K_NAME_REQUIRED'
                );
            }
        }
    }

    // 3. Guardar estado anterior para audit
    const before = {
        receiverRnc: invoice.receiverRnc,
        receiverName: invoice.receiverName,
        issuedAt: invoice.issuedAt,
        subtotal: invoice.subtotal,
        itbis: invoice.itbis,
        total: invoice.total,
        modificationCode: invoice.modificationCode,
        modificationReason: invoice.modificationReason
    };

    // 4. Procesar en transacción
    const result = await sequelize.transaction(async (t) => {
        const updateData = {};

        // 4.1. Datos del comprador
        if (updates.receiverRnc !== undefined) {
            updateData.receiverRnc = updates.receiverRnc || null;
        }
        if (updates.receiverName !== undefined) {
            updateData.receiverName = updates.receiverName || null;
        }
        if (updates.issuedAt !== undefined) {
            updateData.issuedAt = new Date(updates.issuedAt);
        }

        // 4.2. Si se envían items, reemplazar TODAS las líneas
        if (updates.items !== undefined) {
            const calculatedLines = updates.items.map((item, index) => {
                const totals = calculateLineTotals(item);
                return {
                    lineNumber: index + 1,
                    itemCode: item.itemCode || null,
                    description: item.description,
                    ...totals,
                    retencion: item.retencion || null
                };
            });

            const invoiceTotals = calculateInvoiceTotals(calculatedLines);

            updateData.subtotal = invoiceTotals.subtotal;
            updateData.itbis = invoiceTotals.itbis;
            updateData.total = invoiceTotals.total;

            // 🔥 NUEVO: desglose fiscal (fix DT-27)
            updateData.montoGravado = invoiceTotals.montoGravado;
            updateData.itbis1Base = invoiceTotals.itbis1Base;
            updateData.itbis1Amount = invoiceTotals.itbis1Amount;
            updateData.itbis2Base = invoiceTotals.itbis2Base;
            updateData.itbis2Amount = invoiceTotals.itbis2Amount;
            updateData.exemptAmount = invoiceTotals.exemptAmount || null;
            await InvoiceLine.destroy({
                where: { invoiceId: invoice.id },
                transaction: t
            });

            await InvoiceLine.bulkCreate(
                calculatedLines.map((line) => ({
                    invoiceId: invoice.id,
                    lineNumber: line.lineNumber,
                    itemCode: line.itemCode,
                    description: line.description,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discount: line.discount,
                    itbisRate: line.itbisRate,
                    itbisAmount: line.itbisAmount,
                    indicadorFacturacion: line.indicadorFacturacion,   // 🔥 NUEVO
                    total: line.total,
                    retencionIndicador: line.retencion?.indicador ?? null,
                    montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                    montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
                })),
                { transaction: t }
            );
        }

        // 🔥 NUEVO: campos editables de Notas (33/34)
        // Solo los tipos 33/34 pueden tener estos campos; si un 31/32 intenta
        // mandarlos, se rechaza (defensa en profundidad — Joi ya lo bloquea).
        if (updates.modificationCode !== undefined || updates.modificationReason !== undefined) {
            if (invoice.type !== '33' && invoice.type !== '34') {
                throw new AppError(
                    'Modification fields only apply to Notas (33/34)',
                    409,
                    'MODIFICATION_FIELDS_NOT_ALLOWED'
                );
            }

            if (updates.modificationCode !== undefined) {
                updateData.modificationCode = updates.modificationCode;
            }
            if (updates.modificationReason !== undefined) {
                updateData.modificationReason = updates.modificationReason || null;
            }
        }

        // 🔥 NUEVO: si es 34 y cambia issuedAt, recalcular indicadorNotaCredito
        // (regla DGII: 0 = ≤30 días, 1 = >30 días desde modifiedNcfDate)
        if (invoice.type === '34' && updates.issuedAt !== undefined) {
            const modDate = new Date(invoice.modifiedNcfDate);
            const newIssuedDate = new Date(updates.issuedAt);
            const diffDays = (newIssuedDate - modDate) / (1000 * 60 * 60 * 24);
            updateData.indicadorNotaCredito = diffDays > 30 ? 1 : 0;
        }

        // 4.3. Actualizar la factura
        await invoice.update(updateData, { transaction: t });

        // 4.3.5. 🔥 Regenerar XML si la factura sigue siendo draft
        // (una factura firmada/enviada NUNCA se regenera: rompe la firma)
        if (invoice.status === 'draft') {
            try {
                const { generateAndSaveInvoiceXML } = require('../documents/xml/xml-integrator');
                await generateAndSaveInvoiceXML(invoice.id, t);
            } catch (xmlErr) {
                console.error('[updateMyInvoice] XML regen failed:', xmlErr.message);
            }
        }


        // 4.4. Audit log
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.updated',
                entity: 'invoice',
                entityId: invoice.id,
                before,
                after: updateData,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        return invoice;
    });

    // 5. Recargar con sequence + lines para la respuesta
    const fullInvoice = await Invoice.findByPk(result.id, {
        include: [
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
            }
        ]
    });

    // 6. 🔥 Regenerar XML en disco si la factura es draft (fire-and-forget)
    if (fullInvoice.status === 'draft' && fullInvoice.xmlContent) {
        const { saveXMLToDisk } = require('../documents/storage/xml-storage');
        saveXMLToDisk(fullInvoice, fullInvoice.xmlContent).catch(err => {
            console.error('[updateMyInvoice] saveXMLToDisk failed:', err.message);
        });
    }

    return buildInvoiceResponse(fullInvoice, {
        lineCount: fullInvoice.lines.length,
        hideXml: false
    });
}

// ------------------------------------------------------------
// Borrar factura (company_admin)
// Solo si status === 'draft' y sin trackId
// ------------------------------------------------------------
async function deleteMyInvoice(companyId, invoiceId, reqUser, reqInfo = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    // 1. Buscar la factura
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId }
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Solo se puede borrar si está en draft
    if (invoice.status !== 'draft') {
        throw new AppError(
            `Cannot delete invoice with status '${invoice.status}'. Only drafts can be deleted.`,
            409,
            'INVOICE_NOT_DELETABLE'
        );
    }

    // 3. Si tiene trackId, ya fue enviada a DGII alguna vez
    if (invoice.trackId) {
        throw new AppError(
            'Cannot delete an invoice that has been sent to DGII. It has a TrackId.',
            409,
            'INVOICE_HAS_TRACKID'
        );
    }

    // 4. Guardar datos para audit ANTES del delete
    const before = {
        id: invoice.id,
        ncf: invoice.ncf,
        type: invoice.type,
        total: Number(invoice.total),
        status: invoice.status,
        receiverName: invoice.receiverName,
        issuedAt: invoice.issuedAt,
        modifiedNcf: invoice.modifiedNcf || null
    };

    // 5. Borrar en transacción
    await sequelize.transaction(async (t) => {
        // 5.1. Audit log ANTES del delete (para conservar entityId)
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.deleted',
                entity: 'invoice',
                entityId: invoice.id,
                before,
                ip: reqInfo.ip || null,
                userAgent: reqInfo.userAgent || null
            }, { transaction: t });
        } catch (err) {
            // Ignorar errores de audit
        }

        // 5.2. Borrar la factura (CASCADE borra invoice_lines)
        await invoice.destroy({ transaction: t });
    });

    return {
        deleted: true,
        before,
        note: 'The NCF consumed by this invoice is NOT returned to the sequence. It remains consumed.'
    };
}

// ------------------------------------------------------------
// Listar TODAS las facturas (solo admin)
// ------------------------------------------------------------
async function listAllInvoices(filters = {}) {
    // Construir where
    const where = {};

    if (filters.companyId) {
        where.companyId = filters.companyId;
    }

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.receiverRnc) {
        where.receiverRnc = filters.receiverRnc;
    }

    if (filters.ncf) {
        where.ncf = filters.ncf;
    }

    // Filtro por fecha de emisión
    if (filters.fromDate || filters.toDate) {
        where.issuedAt = {};
        if (filters.fromDate) {
            where.issuedAt[Op.gte] = filters.fromDate;
        }
        if (filters.toDate) {
            where.issuedAt[Op.lte] = filters.toDate;
        }
    }

    // Filtro por hasTrackId
    if (filters.hasTrackId !== undefined) {
        if (filters.hasTrackId === true) {
            where.trackId = { [Op.ne]: null };
        } else {
            where.trackId = { [Op.eq]: null };
        }
    }

    // Paginación
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const offset = (page - 1) * limit;

    // Include de Company (con filtro por search si aplica)
    const companyInclude = {
        model: Company,
        as: 'company',
        attributes: ['id', 'rnc', 'name', 'isActive']
    };

    if (filters.search) {
        companyInclude.where = {
            [Op.or]: [
                { rnc: { [Op.iLike]: `%${filters.search}%` } },
                { name: { [Op.iLike]: `%${filters.search}%` } }
            ]
        };

        companyInclude.required = true; // INNER JOIN
    }

    // Query con include de company y sequence
    const { count, rows } = await Invoice.findAndCountAll({
        where,
        include: [
            companyInclude,
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber']
            }
        ],
        order: [['issuedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    // Contar líneas de cada factura (una sola query agrupada)
    const invoiceIds = rows.map(r => r.id);
    let lineCounts = {};

    if (invoiceIds.length > 0) {
        const counts = await InvoiceLine.findAll({
            attributes: [
                'invoiceId',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: { invoiceId: { [Op.in]: invoiceIds } },
            group: ['invoiceId'],
            raw: true
        });
        counts.forEach(c => {
            lineCounts[c.invoiceId] = Number(c.count);
        });
    }

    // Enriquecer cada factura
    const items = rows.map((inv) => {
        const result = buildInvoiceResponse(inv, { lineCount: lineCounts[inv.id] || 0 });
        return result.invoice;
    });

    const totalPages = Math.ceil(count / limit);

    return {
        items,
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
// Ver CUALQUIER factura (solo admin)
// ------------------------------------------------------------
async function getInvoiceById(invoiceId) {
    // 1. Buscar la factura SIN filtrar por companyId
    const invoice = await Invoice.findByPk(invoiceId, {
        include: [
            {
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'address', 'dgiiEnvironment', 'isActive']
            },
            {
                model: Sequence,
                as: 'sequence',
                attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber', 'expiresAt', 'isActive']
            },
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 2. Contar líneas
    const lineCount = invoice.lines?.length || 0;

    // 3. Construir respuesta (SÍ exponer XML en detalle de admin)
    return buildInvoiceResponse(invoice, {
        lineCount,
        hideXml: false
    });
}

// ------------------------------------------------------------
// Generar/obtener el PDF de una factura (company_admin)
// Cachea el PDF en disco.
// ------------------------------------------------------------
// ------------------------------------------------------------
// Generar/obtener el PDF de una factura (company_admin)
// Cachea el PDF en disco por formato.
// ------------------------------------------------------------
async function getMyInvoicePDF(companyId, invoiceId, format = 'a4') {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Validar formato
    const { normalizeFormat } = require('../documents/pdf/pdf-generator');
    const normalizedFormat = normalizeFormat(format);

    // 2. Buscar la factura con relaciones
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        include: [
            {
                model: InvoiceLine,
                as: 'lines',
                separate: true,
                order: [['lineNumber', 'ASC']]
            },
            {
                model: Company,
                as: 'company',
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity']
            }
        ]
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 3. Intentar leer del caché
    const { readPDFFromDisk, savePDFToDisk } = require('../documents/storage/pdf-storage');

    let pdfBuffer = await readPDFFromDisk(invoice, normalizedFormat);

    if (!pdfBuffer) {
        // 4. Generar PDF
        const { generateInvoicePDF } = require('../documents/pdf/pdf-generator');

        pdfBuffer = await generateInvoicePDF(
            invoice,
            invoice.lines,
            invoice.company,
            normalizedFormat
        );

        // 5. Guardar en disco (fire-and-forget)
        savePDFToDisk(invoice, pdfBuffer, normalizedFormat).catch(err => {
            console.error('[getMyInvoicePDF] savePDFToDisk failed:', err.message);
        });
    }

    return { buffer: pdfBuffer, ncf: invoice.ncf, format: normalizedFormat };
}

// ------------------------------------------------------------
// Obtener el XML de una factura (company_admin)
//
// type = 'unsigned' → invoice.xmlContent (default)
// type = 'signed'   → invoice.xmlSigned
//
// Devuelve { xml, ncf, type }
// ------------------------------------------------------------
async function getMyInvoiceXML(companyId, invoiceId, type = 'unsigned') {
    if (!companyId) {
        throw new AppError('You do not belong to any company', 400, 'NO_COMPANY_ASSIGNED');
    }

    // 1. Validar tipo
    if (type !== 'unsigned' && type !== 'signed') {
        throw new AppError(
            `Invalid XML type: ${type}. Must be "unsigned" or "signed".`,
            400,
            'INVALID_XML_TYPE'
        );
    }

    // 2. Buscar la factura (multi-tenant)
    const invoice = await Invoice.findOne({
        where: { id: invoiceId, companyId },
        attributes: ['id', 'ncf', 'type', 'status', 'issuedAt', 'companyId', 'xmlContent', 'xmlSigned']
    });

    if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    // 3. Determinar el contenido según el tipo
    const isSigned = type === 'signed';
    const xmlFromDb = isSigned ? invoice.xmlSigned : invoice.xmlContent;

    if (!xmlFromDb) {
        // No hay XML en BD
        if (isSigned) {
            throw new AppError(
                'Invoice has not been signed yet. Cannot download signed XML.',
                409,
                'INVOICE_NOT_SIGNED'
            );
        } else {
            throw new AppError(
                'Invoice has no XML generated yet. Try editing the invoice to regenerate it.',
                409,
                'XML_NOT_GENERATED'
            );
        }
    }

    // 4. Intentar leer del disco (fallback a BD)
    const { readXMLFromDisk } = require('../documents/storage/xml-storage');

    let xml = await readXMLFromDisk(invoice, type);

    // Si el disco no lo tiene, usar el de BD
    if (!xml) {
        xml = xmlFromDb;
    }

    return {
        xml,
        ncf: invoice.ncf,
        type
    };
}

module.exports = {
    listMyInvoices,
    getMyInvoiceById,
    createMyInvoice,
    updateMyInvoice,
    deleteMyInvoice,
    listAllInvoices,
    getInvoiceById,
    getMyInvoicePDF,
    getMyInvoiceXML,
    // 🔥 NUEVO: helpers reutilizables para internalBilling
    _helpers: {
        assignNextNCF,
        calculateLineTotals,
        calculateInvoiceTotals,
        buildInvoiceResponse,
        mapTransporteFields,
        mapInfoAdicionalFields,
        resolveModifiedInvoice
    }
};

