// ============================================================
// Servicio de facturas
// Pendiente: agregar funciones cuando se implementen los endpoints
// ============================================================

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
    Company,
    Plan,
    Subscription,
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
    const itbisRate = Number(item.itbisRate || 0);

    // Base imponible = (cantidad × precio) - descuento
    const lineBase = (quantity * unitPrice) - discount;

    // ITBIS = base × (tasa / 100)
    const itbisAmount = lineBase * (itbisRate / 100);

    // Total de la línea = base + ITBIS
    // Redondeamos a 2 decimales
    const total = Math.round((lineBase + itbisAmount) * 100) / 100;

    return {
        quantity,
        unitPrice,
        discount,
        itbisRate,
        lineBase: Math.round(lineBase * 100) / 100,
        itbisAmount: Math.round(itbisAmount * 100) / 100,
        total
    };
}

// ------------------------------------------------------------
// Helper: calcular totales de la factura completa
// ------------------------------------------------------------
function calculateInvoiceTotals(lines) {
    let subtotal = 0;
    let itbis = 0;
    let total = 0;

    for (const line of lines) {
        subtotal += line.lineBase;
        itbis += line.itbisAmount;
        total += line.total;
    }

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        itbis: Math.round(itbis * 100) / 100,
        total: Math.round(total * 100) / 100
    };
}

// ------------------------------------------------------------
// Helper: asignar el siguiente e-NCF desde una secuencia activa
// TRANSACCIONAL — debe llamarse dentro de sequelize.transaction
// ------------------------------------------------------------
async function assignNextNCF(companyId, type, transaction) {
    // 1. Buscar la secuencia activa, vigente, con números disponibles, ordenada por vencimiento

    const sequence = await Sequence.findOne({
        where: {
            companyId,
            type,
            isActive: true,
            expiresAt: { [Op.gt]: new Date() }
        },
        order: [['expiresAt', 'ASC'], ['createdAt', 'ASC']],
        lock: transaction.LOCK.UPDATE, // ← Lock pesimista
        transaction
    });

    // 2. Si no existe secuencia activa
    if (!sequence) {
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
    await sequence.update(
        { currentNumber: nextNumber },
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

    // 1. Empresa activa
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

    // 2. Suscripción activa
    const subscription = await Subscription.findOne({
        where: {
            companyId,
            status: ['trial', 'active', 'past_due']
        },
        include: [{ model: Plan, as: 'plan' }],
        order: [['createdAt', 'DESC']]
    });

    if (!subscription) {
        throw new AppError(
            'No active subscription found. Please contact support.',
            403,
            'NO_ACTIVE_SUBSCRIPTION'
        );
    }

    // 3. Límite mensual
    const planLimit = subscription.plan?.invoicesPerMonth;
    const usedThisMonth = Number(subscription.invoicesUsedThisMonth) || 0;

    if (planLimit !== -1 && usedThisMonth >= planLimit) {
        throw new AppError(
            `Monthly invoice limit reached (${usedThisMonth}/${planLimit}). Upgrade your plan to continue.`,
            403,
            'INVOICE_LIMIT_REACHED'
        );
    }

    // 4. Transacción
    const result = await sequelize.transaction(async (t) => {
        // 4.1. Notas (33/34): resolver factura original
        let originalInvoice = null;
        if (isNota) {
            originalInvoice = await resolveModifiedInvoice(companyId, type, modifiedNcf, t);
        }

        // 4.2. Asignar NCF
        const { sequence, ncf } = await assignNextNCF(companyId, type, t);

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
            subtotal: invoiceTotals.subtotal,
            itbis: invoiceTotals.itbis,
            total: invoiceTotals.total,

            // Exento (43, 44, 47)
            exemptAmount: exemptAmount ?? null,

            // ITBIS3 (46)
            itbis3Base: itbis3Base ?? null,
            itbis3Amount: itbis3Amount ?? null,

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
                total: line.total,
                // 🔥 NUEVO: retención por línea (41, 47)
                retencionIndicador: line.retencion?.indicador ?? null,
                montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
            })),
            { transaction: t, returning: true }
        );

        // 4.9. Incrementar contador
        await subscription.increment('invoicesUsedThisMonth', {
            by: 1,
            transaction: t
        });

        // 4.10. Audit log (con info nueva siempre)
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser.id,
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

    // 🔥 NUEVO: validar coherencia tipo vs retención por línea
    // (Joi valida forma; aquí validamos contra el tipo real de la factura)
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

        // 4.4. Audit log
        try {
            await AuditLog.create({
                companyId,
                userId: reqUser.id,
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
                userId: reqUser.id,
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

module.exports = {
    listMyInvoices,
    getMyInvoiceById,
    createMyInvoice,
    updateMyInvoice,
    deleteMyInvoice,
    listAllInvoices,
    getInvoiceById
};

