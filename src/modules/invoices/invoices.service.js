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
    InvoiceSubtotal,
    InvoiceDiscountCharge,
    CompanyLogo,
    RfceDocument,
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
        // Básicos (ya existían)
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
        infoNombrePuertoDesembarque: info.nombrePuertoDesembarque || null,

        // DT30 — Nuevos de <InformacionesAdicionales>
        infoNumeroReferencia: info.numeroReferencia || null,
        infoPesoBruto: info.pesoBruto ?? null,
        infoPesoNeto: info.pesoNeto ?? null,
        infoUnidadPesoBruto: info.unidadPesoBruto ?? null,
        infoUnidadPesoNeto: info.unidadPesoNeto ?? null,
        infoCantidadBulto: info.cantidadBulto ?? null,
        infoUnidadBulto: info.unidadBulto ?? null,
        infoVolumenBulto: info.volumenBulto ?? null,
        infoUnidadVolumen: info.unidadVolumen ?? null
    };
}


// ------------------------------------------------------------
// Helper: validar y cargar la factura original que modifica
// el e-CF que se está emitiendo.
//
// TRANSACCIONAL — se llama dentro de la tx para bloquear la fila.
//
// Reglas por tipo (DT35 — Sección F: <InformacionReferencia>):
//
//   - 33 y 34 (Notas):
//       SIEMPRE requieren original. El original debe ser 31 o 32,
//       estar sent/accepted, y no tener ya una nota activa.
//
//   - 31 con modificationCode = 5 (Referencia FC):
//       Requiere original. El original DEBE ser 32 (FC Consumo),
//       estar sent/accepted, y no tener ya una referencia activa
//       desde otro 31.
//
//   - Cualquier tipo con modificationCode = 4 (Reemplazo contingencia):
//       Requiere intentar buscar el original. Si existe en BD, se
//       valida que su tipo sea equivalente al tipo emitido. Si NO
//       existe (porque es un NCF de papel emitido en contingencia),
//       se permite y solo se valida el formato del NCF de papel
//       (11 o 19 chars, empieza con A o B).
//
//   - Resto de combinaciones (tipo != 33/34 y sin code 4/5):
//       NO requiere original. Retorna null.
//
// Devuelve el `original` (instancia Invoice) o null.
// ------------------------------------------------------------
async function resolveModifiedInvoice(companyId, type, modifiedNcf, modificationCode, transaction) {
    const code = modificationCode !== undefined && modificationCode !== null
        ? Number(modificationCode)
        : null;

    // 1. Determinar si este tipo/código REQUIERE buscar el original en BD
    const isNota = type === '33' || type === '34';
    const isFC31Referencing32 = type === '31' && code === 5;
    const isContingencyReplacement = code === 4;

    const needsOriginalLookup =
        isNota ||
        isFC31Referencing32 ||
        isContingencyReplacement;

    if (!needsOriginalLookup) {
        return null;
    }

    // 2. Buscar la factura original por NCF en la misma empresa
    const original = await Invoice.findOne({
        where: {
            companyId,
            ncf: modifiedNcf
        },
        transaction
    });

    // ------------------------------------------------------------
    // 3. Caso especial: CodigoModificacion = 4 (Reemplazo contingencia)
    //
    // El NCF modificado puede ser de papel (emitido en contingencia),
    // en cuyo caso NO existe en BD. Eso es válido: se permite y solo
    // se valida el formato del NCF de papel.
    // Si SÍ existe en BD, validamos que el tipo sea equivalente.
    // ------------------------------------------------------------
    if (isContingencyReplacement && !isNota && !isFC31Referencing32) {
        const ncfStr = String(modifiedNcf || '').trim();
        const esPapel = (ncfStr.length === 11 || ncfStr.length === 19)
            && /^[AB]/.test(ncfStr);
        const esElectronico = ncfStr.length === 13 && /^E/.test(ncfStr);

        if (!esPapel && !esElectronico) {
            throw new AppError(
                `CodigoModificacion=4: NCFModificado debe ser electrónico (13 chars, empieza con E) o de papel (11 o 19 chars, empieza con A o B). Recibido: "${ncfStr}"`,
                409,
                'INVALID_MODIFIED_NCF_FORMAT'
            );
        }

        // Si NO existe en BD → es un NCF de papel emitido en contingencia.
        // Permitir, no hay nada más que validar contra BD.
        if (!original) {
            return null;
        }

        // Si SÍ existe → validar tipo equivalente y status
        if (original.status !== 'sent' && original.status !== 'accepted') {
            throw new AppError(
                `Cannot replace an invoice with status '${original.status}'. It must be sent or accepted.`,
                409,
                'ORIGINAL_NOT_EMITTED'
            );
        }

        if (String(original.type) !== String(type)) {
            throw new AppError(
                `CodigoModificacion=4 requires the original invoice to be of equivalent type. ` +
                `Original type: ${original.type}, current type: ${type}.`,
                409,
                'MOD_CODE_4_TYPE_MISMATCH'
            );
        }

        return original;
    }

    // ------------------------------------------------------------
    // 4. A partir de aquí: el original DEBE existir en BD
    //    (notas 33/34 y FC 31 con code 5).
    // ------------------------------------------------------------
    if (!original) {
        throw new AppError(
            `Original invoice with NCF ${modifiedNcf} not found`,
            404,
            'ORIGINAL_INVOICE_NOT_FOUND'
        );
    }

    // 5. La original debe estar emitida (sent o accepted), nunca draft
    if (original.status !== 'sent' && original.status !== 'accepted') {
        throw new AppError(
            `Cannot modify an invoice with status '${original.status}'. It must be sent or accepted.`,
            409,
            'ORIGINAL_NOT_EMITTED'
        );
    }

    // 6. Validación de tipo del original según el caso
    if (isNota) {
        // Notas (33/34): el original debe ser 31 o 32
        if (original.type !== '31' && original.type !== '32') {
            throw new AppError(
                `Cannot reference an invoice of type ${original.type}. Only 31 or 32 can be modified by a Nota.`,
                409,
                'INVALID_ORIGINAL_TYPE'
            );
        }
    }

    if (isFC31Referencing32) {
        // 31 con code 5: el original DEBE ser 32 (FC Consumo)
        if (original.type !== '32') {
            throw new AppError(
                `CodigoModificacion=5 requires the original NCF to be type 32 (Factura de Consumo). ` +
                `Original type: ${original.type}.`,
                409,
                'MOD_CODE_5_ORIGINAL_NOT_32'
            );
        }
    }

    // 7. No debe existir ya una nota/referencia ACTIVA que modifique la misma factura
    //    (excepto si es un code 4 reemplazando, que ya se manejó arriba).
    const existingActive = await Invoice.findOne({
        where: {
            companyId,
            modifiedNcf,
            type: { [Op.in]: ['31', '33', '34'] },
            status: { [Op.notIn]: ['rejected'] }
        },
        transaction
    });

    if (existingActive) {
        throw new AppError(
            `Invoice ${modifiedNcf} already has an active reference (${existingActive.ncf}, type ${existingActive.type})`,
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
        canEditReference: false,
        // DT39 — flag para el front
        isRfce: data.type === '32' && Number(data.total) < 250000,
        hasRfceDocument: !!data.rfce,
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
    const recargo = Number(item.recargo || 0);

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

    // Base = (cantidad × precio) - descuento + recargo
    const lineBase = (quantity * unitPrice) - discount + recargo;

    // ITBIS = base × (tasa / 100)
    const itbisAmount = lineBase * (itbisRate / 100);

    // Total de la línea = base + ITBIS
    const total = Math.round((lineBase + itbisAmount) * 100) / 100;

    return {
        // Calculados
        quantity,
        unitPrice,
        discount,
        recargo,
        itbisRate,
        indicadorFacturacion: indicador,
        lineBase: Math.round(lineBase * 100) / 100,
        itbisAmount: Math.round(itbisAmount * 100) / 100,
        total,

        // Propagados tal cual desde el payload (nuevos campos DGII)
        itemName: item.itemName ?? null,
        description: item.description ?? null,
        indicadorBienoServicio: item.indicadorBienoServicio ?? 1,
        unidadMedida: item.unidadMedida ?? null,
        cantidadReferencia: item.cantidadReferencia ?? null,
        unidadReferencia: item.unidadReferencia ?? null,
        gradosAlcohol: item.gradosAlcohol ?? null,
        precioUnitarioReferencia: item.precioUnitarioReferencia ?? null,
        fechaElaboracion: item.fechaElaboracion ?? null,
        fechaVencimientoItem: item.fechaVencimientoItem ?? null,
        // DT31 — Sub-bloques del <Item>
        additionalCodes: item.additionalCodes ?? null,
        subcantidades: item.subcantidades ?? null,
        subDescuentos: item.subDescuentos ?? null,
        subRecargos: item.subRecargos ?? null,
        impuestosAdicionales: item.impuestosAdicionales ?? null,
        pesoNetoKilogramo: item.pesoNetoKilogramo ?? null,
        pesoNetoMineria: item.pesoNetoMineria ?? null,
        tipoAfiliacion: item.tipoAfiliacion ?? null,
        liquidacion: item.liquidacion ?? null,
        // DT32 — Subtotal informativo: a qué grupo pertenece esta línea
        subtotalId: item.subtotalId ?? null,
    };
}


// ============================================================
// DT32 — Helpers: subtotales informativos (<Subtotales> del XML)
//
// El cliente solo manda la metadata de los grupos (numeroSubtotal,
// descripcion, orden) y marca cada línea con `subtotalId`.
// El SERVICE calcula los montos sumando las líneas del grupo.
// ============================================================

/**
 * Redondeo monetario a 2 decimales con "half up" (mismo criterio
 * que roundMoney de DT33 — se redefine aquí por orden de carga
 * del módulo, pero es idéntico).
 */
function roundMoney2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula los subtotales a partir de las líneas ya calculadas.
 *
 * @param {Array} subtotalesInput - [{ numeroSubtotal, descripcion, orden }]
 * @param {Array} calculatedLines - líneas ya pasadas por calculateLineTotals
 *                                  (deben tener `subtotalId` y `lineBase`,
 *                                  `itbisAmount`, `indicadorFacturacion`, `total`)
 * @returns {Array} subtotales con montos calculados, listos para bulkCreate
 *
 * Reglas:
 *   - Cada subtotal agrupa las líneas con `subtotalId === numeroSubtotal`.
 *   - Si un subtotal no tiene líneas, devuelve error (Joi ya lo valida,
 *     pero defendemos en profundidad).
 *   - `lineas` = cantidad de líneas del grupo (no array).
 *   - `subTotalImpuestoAdicional` = 0 por ahora (impuestos adicionales
 *     por línea solo declaran código, no monto — ver ADDITIONAL_TAXES
 *     cuando se implemente el cálculo de ISC).
 */
function calculateSubtotalsFromLines(subtotalesInput, calculatedLines) {
    if (!Array.isArray(subtotalesInput) || subtotalesInput.length === 0) {
        return [];
    }

    const lines = Array.isArray(calculatedLines) ? calculatedLines : [];

    return subtotalesInput.map((st) => {
        const numero = Number(st.numeroSubtotal);
        const lineasDelGrupo = lines.filter(
            (l) => l.subtotalId !== null
                && l.subtotalId !== undefined
                && Number(l.subtotalId) === numero
        );

        let montoGravadoI1 = 0;
        let montoGravadoI2 = 0;
        let montoGravadoI3 = 0;
        let subTotalItbis1 = 0;
        let subTotalItbis2 = 0;
        let subTotalItbis3 = 0;
        let subTotalExento = 0;
        let montoSubTotal = 0;

        for (const line of lineasDelGrupo) {
            const ind = Number(line.indicadorFacturacion);
            const base = Number(line.lineBase || 0);
            const itbis = Number(line.itbisAmount || 0);

            if (ind === 1) {
                montoGravadoI1 += base;
                subTotalItbis1 += itbis;
            } else if (ind === 2) {
                montoGravadoI2 += base;
                subTotalItbis2 += itbis;
            } else if (ind === 3) {
                montoGravadoI3 += base;
                subTotalItbis3 += itbis;
            } else if (ind === 4) {
                subTotalExento += base;
            }
            // ind === 0 (No Facturable) no suma a bases, solo al total

            montoSubTotal += Number(line.total || 0);
        }

        const montoGravadoTotal = montoGravadoI1 + montoGravadoI2 + montoGravadoI3;
        const subTotalItbis = subTotalItbis1 + subTotalItbis2 + subTotalItbis3;

        return {
            numeroSubtotal: numero,
            descripcion: st.descripcion || null,
            orden: st.orden ?? null,
            lineas: lineasDelGrupo.length,
            montoGravadoTotal: roundMoney2(montoGravadoTotal),
            montoGravadoI1: roundMoney2(montoGravadoI1),
            montoGravadoI2: roundMoney2(montoGravadoI2),
            montoGravadoI3: roundMoney2(montoGravadoI3),
            subTotalItbis: roundMoney2(subTotalItbis),
            subTotalItbis1: roundMoney2(subTotalItbis1),
            subTotalItbis2: roundMoney2(subTotalItbis2),
            subTotalItbis3: roundMoney2(subTotalItbis3),
            subTotalImpuestoAdicional: 0, // ver nota arriba
            subTotalExento: roundMoney2(subTotalExento),
            montoSubTotal: roundMoney2(montoSubTotal)
        };
    });
}

/**
 * Valida que la suma de subtotales cuadre con el total de la factura.
 * Lanza AppError si no cuadra (tolerancia 1 centavo por redondeo).
 */
function assertSubtotalsMatchInvoiceTotal(subtotalesCalculados, invoiceTotal) {
    if (!Array.isArray(subtotalesCalculados) || subtotalesCalculados.length === 0) {
        return;
    }
    const sumaSubtotales = subtotalesCalculados.reduce(
        (s, st) => s + Number(st.montoSubTotal || 0),
        0
    );
    const totalFactura = Number(invoiceTotal || 0);
    if (Math.abs(roundMoney2(sumaSubtotales) - roundMoney2(totalFactura)) > 0.01) {
        throw new AppError(
            `Los subtotales (${roundMoney2(sumaSubtotales)}) no cuadran con el total de la factura (${roundMoney2(totalFactura)}). Cada línea debe estar asignada a exactamente un subtotal.`,
            409,
            'SUBTOTALS_MISMATCH'
        );
    }
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


// ============================================================
// DT33 — Helpers: descuentos y recargos GLOBALES
// ============================================================

/**
 * Redondeo monetario a 2 decimales con "half up".
 *
 * Usa Number.EPSILON para evitar el bug clásico de floats:
 *   1.005 → sin EPSILON da 1.00 (incorrecto), con EPSILON da 1.01 (correcto).
 *
 * Uso: TODO cálculo monetario del service pasa por aquí antes de guardar en BD
 * o de emitir en el XML. Nunca devolvemos floats "sucios" al modelo.
 */
function roundMoney(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Redondeo de porcentaje a 2 decimales (semánticamente distinto de roundMoney,
 * pero misma aritmética).
 */
function roundPercent(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el `monto` de un descuento/recargo cuando tipoValor = '%'.
 *
 * Base según indicadorFacturacion:
 *   1 → itbis1Base (18%)
 *   2 → itbis2Base (16%)
 *   3 → itbis3Base (0% gravado, exportación)
 *   4 → exemptAmount
 *
 * @param {Object} descuento - { indicadorFacturacion, valor, ... }
 * @param {Object} invoiceTotals - resultado de calculateInvoiceTotals
 * @returns {number} monto redondeado a 2 decimales
 * @throws {AppError} si indicadorFacturacion no es 1/2/3/4
 */
function calculateMontoForPercent(descuento, invoiceTotals) {
    const ind = Number(descuento.indicadorFacturacion);
    const valor = Number(descuento.valor);

    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
        throw new AppError(
            `Valor de descuento/recargo inválido: ${descuento.valor}. Debe ser > 0 y <= 100.`,
            400,
            'INVALID_DESCUENTO_VALOR'
        );
    }

    let base;
    if (ind === 1) base = Number(invoiceTotals.itbis1Base || 0);
    else if (ind === 2) base = Number(invoiceTotals.itbis2Base || 0);
    else if (ind === 3) base = Number(invoiceTotals.itbis3Base || 0);
    else if (ind === 4) base = Number(invoiceTotals.exemptAmount || 0);
    else throw new AppError(
        `indicadorFacturacion=${ind} no soportado para descuento/recargo con tipoValor='%'. Debe ser 1, 2, 3 o 4.`,
        400,
        'INVALID_INDICADOR_FACTURACION'
    );

    return roundMoney(base * (valor / 100));
}

/**
 * Aplica los descuentos/recargos globales a los totales de la factura.
 *
 * Reglas del PDF DGII v1.0 — Sección D:
 *
 *   1. Descuento (D) RESTA de la base según indicadorFacturacion.
 *   2. Recargo (R) SUMA a la base según indicadorFacturacion.
 *   3. Si indicadorNorma1007 = 1 (solo aplica a D):
 *      - NO se resta de la base gravada (itbisXBase / exemptAmount).
 *      - SÍ se resta del total (MontoTotal / ValorPagar).
 *   4. Se recalculan ITBIS por tasa sobre las nuevas bases.
 *   5. Se recalculan montoGravado, subtotal y total.
 *
 * @param {Object} invoiceTotals - resultado de calculateInvoiceTotals (preliminar)
 * @param {Array} descuentos - array de descuentos ya con `monto` calculado
 * @returns {Object} copia de invoiceTotals con los ajustes aplicados
 */
function applyDescuentosToTotals(invoiceTotals, descuentos) {
    // Sin descuentos → no tocar nada (devolver el mismo objeto)
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return invoiceTotals;
    }

    // Copia defensiva: no mutamos el original
    const t = { ...invoiceTotals };

    // Acumuladores por base (en valor absoluto)
    let deltaItbis1Base = 0;
    let deltaItbis2Base = 0;
    let deltaItbis3Base = 0;
    let deltaExempt = 0;

    for (const d of descuentos) {
        const ind = Number(d.indicadorFacturacion);
        const monto = roundMoney(d.monto);
        // D resta, R suma
        const signo = d.tipoAjuste === 'D' ? -1 : 1;
        const montoSigned = signo * monto;

        // Regla IndicadorNorma1007 (solo aplica a descuentos):
        // si está en 1, NO se resta de la base gravada.
        // El descuento normativo solo afecta al ValorPagar (que no calculamos
        // en esta fase — queda como deuda para DT34).
        const isDescuento = d.tipoAjuste === 'D';
        const skipBase = isDescuento && Number(d.indicadorNorma1007) === 1;

        if (ind === 1) {
            if (!skipBase) deltaItbis1Base += montoSigned;
        } else if (ind === 2) {
            if (!skipBase) deltaItbis2Base += montoSigned;
        } else if (ind === 3) {
            if (!skipBase) deltaItbis3Base += montoSigned;
        } else if (ind === 4) {
            if (!skipBase) deltaExempt += montoSigned;
        } else {
            // No debería llegar aquí (validado en Joi y en calculateMontoForPercent)
            throw new AppError(
                `indicadorFacturacion=${ind} inválido al aplicar descuentos`,
                400,
                'INVALID_INDICADOR_FACTURACION'
            );
        }
    }

    // Aplicar deltas a las bases
    t.itbis1Base = roundMoney(Number(t.itbis1Base || 0) + deltaItbis1Base);
    t.itbis2Base = roundMoney(Number(t.itbis2Base || 0) + deltaItbis2Base);
    t.itbis3Base = roundMoney(Number(t.itbis3Base || 0) + deltaItbis3Base);
    t.exemptAmount = roundMoney(Number(t.exemptAmount || 0) + deltaExempt);

    // Recalcular ITBIS sobre las nuevas bases (tasa fija por indicador)
    t.itbis1Amount = roundMoney(t.itbis1Base * 0.18);
    t.itbis2Amount = roundMoney(t.itbis2Base * 0.16);
    t.itbis3Amount = roundMoney(t.itbis3Base * 0.00);
    t.itbis = roundMoney(t.itbis1Amount + t.itbis2Amount + t.itbis3Amount);

    // montoGravado = suma de bases gravadas (1, 2, 3)
    t.montoGravado = roundMoney(t.itbis1Base + t.itbis2Base + t.itbis3Base);

    // subtotal = suma de bases (gravadas + exentas)
    t.subtotal = roundMoney(t.montoGravado + t.exemptAmount);

    // total = bases + ITBIS recalculados
    // (NO usamos invoiceTotals.total + delta porque el ITBIS pudo cambiar)
    t.total = roundMoney(t.montoGravado + t.exemptAmount + t.itbis);

    return t;
}


/**
 * Calcula el ValorPagar cuando hay descuentos con indicadorNorma1007 = 1.
 *
 * Regla del PDF DGII:
 *   - Los descuentos con indicadorNorma1007 = 1 NO restan del MontoTotal
 *     (ni de la base gravada, ni del ITBIS).
 *   - Pero SÍ restan del ValorPagar.
 *
 * Fórmula:
 *   ValorPagar = MontoTotal - Σ(descuentos con indicadorNorma1007 = 1)
 *
 * Nota: solo aplica a descuentos (tipoAjuste = 'D'). Los recargos (R) no
 * llevan indicadorNorma1007 (validado en Joi).
 *
 * @param {number} montoTotal - MontoTotal ya calculado (con o sin descuentos normales)
 * @param {Array} descuentos - array de descuentos ya resueltos (con monto)
 * @returns {number|null} ValorPagar redondeado, o null si no aplica
 */
function calculateValorPagarNorma1007(montoTotal, descuentos) {
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return null;
    }

    // Filtrar solo descuentos (D) con indicadorNorma1007 = 1
    const descuentosNorma1007 = descuentos.filter(d =>
        d.tipoAjuste === 'D' &&
        Number(d.indicadorNorma1007) === 1
    );

    if (descuentosNorma1007.length === 0) {
        return null;
    }

    const totalDescuentosNorma1007 = descuentosNorma1007.reduce(
        (sum, d) => sum + roundMoney(d.monto),
        0
    );

    return roundMoney(Number(montoTotal) - totalDescuentosNorma1007);
}

/**
 * Resuelve el `monto` final de un descuento/recargo antes de guardarlo:
 *
 *   - tipoValor = '$' → usa el monto del body (el cliente decidió).
 *   - tipoValor = '%' → el service lo calcula (ignora el monto del body si vino).
 *
 * Devuelve una copia del objeto descuento con el monto ya resuelto.
 */
function resolveDescuentoMonto(descuento, invoiceTotals) {
    const resolved = { ...descuento };

    if (descuento.tipoValor === '$') {
        // El cliente manda el monto; lo redondeamos por seguridad
        resolved.monto = roundMoney(Number(descuento.monto || 0));
    } else if (descuento.tipoValor === '%') {
        // El service calcula el monto a partir de la base real
        resolved.monto = calculateMontoForPercent(descuento, invoiceTotals);
    } else {
        throw new AppError(
            `tipoValor inválido: ${descuento.tipoValor}. Debe ser '%' o '$'.`,
            400,
            'INVALID_TIPO_VALOR'
        );
    }

    return resolved;
}

/**
 * Prepara el array de descuentos para guardar:
 *   1. Calcula el monto de cada uno (con las bases preliminares).
 *   2. Devuelve el array con montos resueltos.
 *
 * IMPORTANTE: se debe llamar ANTES de aplicar los descuentos a los totales,
 * porque necesitamos las bases preliminares para calcular los montos.
 */
function prepareDescuentos(descuentos, invoiceTotals) {
    if (!Array.isArray(descuentos) || descuentos.length === 0) {
        return [];
    }
    return descuentos.map(d => resolveDescuentoMonto(d, invoiceTotals));
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
        indicadorNotaCredito,

        // ============================================================
        // DT30 — IdDoc extendido
        // ============================================================
        indicadorEnvioDiferido,
        indicadorMontoGravado,
        indicadorServicioTodoIncluido,
        tipoIngresos,
        tipoPago,
        fechaLimitePago,
        terminoPago,
        formasPago,
        tipoCuentaPago,
        numeroCuentaPago,
        bancoPago,
        fechaDesde,
        fechaHasta,
        totalPaginas,

        // ============================================================
        // DT30 — Emisor extendido (los que viven en Invoice)
        // ============================================================
        codigoVendedor,
        numeroFacturaInterna,
        numeroPedidoInterno,
        zonaVenta,
        rutaVenta,
        informacionAdicionalEmisor,

        // ============================================================
        // DT30 — Comprador extendido
        // ============================================================
        contactoComprador,
        correoComprador,
        direccionComprador,
        municipioComprador,
        provinciaComprador,
        fechaEntrega,
        contactoEntrega,
        direccionEntrega,
        telefonoAdicional,
        fechaOrdenCompra,
        numeroOrdenCompra,
        codigoInternoComprador,
        responsablePago,
        informacionAdicionalComprador,

        // ============================================================
        // DT30 — Info adicional extendido (los sueltos, no anidados)
        // OJO: los 9 campos del InfoAdicional (numeroReferencia, pesoBruto,
        // etc.) van anidados dentro de `informacionesAdicionales`. Aquí
        // NO se destructuran — viajan dentro del objeto.
        // ============================================================

        // ============================================================
        // DT30 — Totales extendido
        // ============================================================
        montoImpuestoAdicional,
        impuestosAdicionales,
        montoNoFacturable,
        montoPeriodo,
        saldoAnterior,
        montoAvancePago,
        valorPagar,
        totalItbisPercepcion,
        totalIsrPercepcion,

        // ============================================================
        // DT30 — OtraMoneda (encabezado)
        // ============================================================
        tipoMoneda,
        tipoCambio,
        montoGravadoTotalOtraMoneda,
        montoGravado1OtraMoneda,
        montoGravado2OtraMoneda,
        montoGravado3OtraMoneda,
        montoExentoOtraMoneda,
        totalItbisOtraMoneda,
        totalItbis1OtraMoneda,
        totalItbis2OtraMoneda,
        totalItbis3OtraMoneda,
        montoImpuestoAdicionalOtraMoneda,
        impuestosAdicionalesOtraMoneda,
        montoTotalOtraMoneda,
        // DT32 — Subtotales
        subtotales,
        // DT33 — Descuentos o Recargos globales
        descuentosORecargos,
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

        // ============================================================
        // 4.1. DT35 — Resolver factura original (sección F)
        //
        // Casos que requieren buscar el original:
        //   - Notas 33/34 (siempre)
        //   - 31 con CodigoModificacion=5 (referencia a FC 32)
        //   - Cualquier tipo con CodigoModificacion=4 (reemplazo contingencia)
        //
        // Si no aplica, `resolveModifiedInvoice` retorna null.
        // ============================================================
        let originalInvoice = null;
        const needsOriginalLookup =
            isNota ||
            (type === '31' && Number(modificationCode) === 5) ||
            (Number(modificationCode) === 4);

        if (needsOriginalLookup) {
            originalInvoice = await resolveModifiedInvoice(
                companyId,
                type,
                modifiedNcf,
                modificationCode,
                t
            );
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

        // 4.4. Totales PRELIMINARES (sin descuentos globales)
        const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

        // ============================================================
        // DT33 — Descuentos y recargos GLOBALES
        // Orden:
        //   1. Resolver el monto de cada descuento (usa bases preliminares).
        //   2. Aplicar descuentos a los totales (recalcula ITBIS, total, etc.).
        // ============================================================
        const descuentosResueltos = prepareDescuentos(
            descuentosORecargos,
            invoiceTotalsPrelim
        );

        const invoiceTotals = applyDescuentosToTotals(
            invoiceTotalsPrelim,
            descuentosResueltos
        );

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

        // ============================================================
        // 4.6. DT35 — Campos de <InformacionReferencia>
        //
        // Se persisten cuando:
        //   - Es una Nota (33/34) → siempre
        //   - Es 31 con code=5 → referencia a FC 32
        //   - Cualquier tipo con code=4 → reemplazo contingencia
        //
        // En el resto de casos, los campos quedan null (no se emite el bloque).
        // ============================================================
        const hasReferencia =
            isNota ||
            (type === '31' && Number(modificationCode) === 5) ||
            (Number(modificationCode) === 4 && modifiedNcf);

        let referenciFields = {};

        if (hasReferencia) {
            // El original puede ser null si es un reemplazo de contingencia
            // de un NCF de papel que no está en BD.
            const originalIssuerRnc = originalInvoice
                ? originalInvoice.issuerRnc
                : null;

            // Normalizar fecha
            let fechaModificada = null;
            if (modifiedNcfDate) {
                fechaModificada = new Date(modifiedNcfDate);
            } else if (originalInvoice && originalInvoice.issuedAt) {
                fechaModificada = new Date(originalInvoice.issuedAt);
            }

            referenciFields = {
                modifiedNcf: modifiedNcf || (originalInvoice ? originalInvoice.ncf : null),
                modifiedNcfIssuerRnc: modifiedNcfIssuerRnc || originalIssuerRnc || null,
                modifiedNcfDate: fechaModificada,
                modificationCode: modificationCode ?? null,
                // RazonModificacion solo aplica a 33/34
                modificationReason: isNota ? (modificationReason || null) : null,
                // IndicadorNotaCredito solo aplica a 34
                indicadorNotaCredito: type === '34' ? indicadorNotaCredito : null
            };
        }

        // 4.6.1 — Resolver el exento final según el tipo:
        //   - Tipos 43, 44, 47: aceptan monto global exento (respetar body,
        //     con fallback a las líneas si viene null).
        //   - Resto de tipos: SIEMPRE derivado de las líneas (fuente de verdad).

        let finalExemptAmount;

        if (['43', '44', '47'].includes(type)) {
            finalExemptAmount = exemptAmount ?? invoiceTotals.exemptAmount;
        } else {
            finalExemptAmount = invoiceTotals.exemptAmount;
        }

        // 4.7. Crear factura (con totales FINALES — ya con descuentos aplicados)
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

            // Desglose fiscal (fix DT-27)
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

            // ============================================================
            // DT30 — IdDoc extendido
            // ============================================================
            indicadorEnvioDiferido: indicadorEnvioDiferido ?? null,
            indicadorMontoGravado: indicadorMontoGravado ?? null,
            indicadorServicioTodoIncluido: indicadorServicioTodoIncluido ?? null,
            tipoIngresos: tipoIngresos || null,
            tipoPago: tipoPago ?? null,
            fechaLimitePago: fechaLimitePago ? new Date(fechaLimitePago) : null,
            terminoPago: terminoPago || null,
            formasPago: formasPago || null,
            tipoCuentaPago: tipoCuentaPago || null,
            numeroCuentaPago: numeroCuentaPago || null,
            bancoPago: bancoPago || null,
            fechaDesde: fechaDesde ? new Date(fechaDesde) : null,
            fechaHasta: fechaHasta ? new Date(fechaHasta) : null,
            totalPaginas: totalPaginas ?? null,

            // ============================================================
            // DT30 — Emisor extendido
            // codigoVendedor: se toma del body o, si no viene, del User
            // ============================================================
            codigoVendedor: codigoVendedor || reqUser?.codigoVendedor || null,
            numeroFacturaInterna: numeroFacturaInterna || null,
            numeroPedidoInterno: numeroPedidoInterno || null,
            zonaVenta: zonaVenta || null,
            rutaVenta: rutaVenta || null,
            informacionAdicionalEmisor: informacionAdicionalEmisor || null,

            // ============================================================
            // DT30 — Comprador extendido
            // ============================================================
            contactoComprador: contactoComprador || null,
            correoComprador: correoComprador || null,
            direccionComprador: direccionComprador || null,
            municipioComprador: municipioComprador || null,
            provinciaComprador: provinciaComprador || null,
            fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
            contactoEntrega: contactoEntrega || null,
            direccionEntrega: direccionEntrega || null,
            telefonoAdicional: telefonoAdicional || null,
            fechaOrdenCompra: fechaOrdenCompra ? new Date(fechaOrdenCompra) : null,
            numeroOrdenCompra: numeroOrdenCompra || null,
            codigoInternoComprador: codigoInternoComprador || null,
            responsablePago: responsablePago || null,
            informacionAdicionalComprador: informacionAdicionalComprador || null,

            // ============================================================
            // DT30 — Totales extendido
            // ============================================================
            montoImpuestoAdicional: montoImpuestoAdicional ?? null,
            impuestosAdicionales: impuestosAdicionales || null,
            montoNoFacturable: montoNoFacturable ?? null,
            montoPeriodo: montoPeriodo ?? null,
            saldoAnterior: saldoAnterior ?? null,
            montoAvancePago: montoAvancePago ?? null,
            valorPagar: valorPagar ?? calculateValorPagarNorma1007(
                invoiceTotals.total,
                descuentosResueltos
            ),
            totalItbisPercepcion: totalItbisPercepcion ?? null,
            totalIsrPercepcion: totalIsrPercepcion ?? null,

            // ============================================================
            // DT30 — OtraMoneda (encabezado)
            // ============================================================
            tipoMoneda: tipoMoneda || null,
            tipoCambio: tipoCambio ?? null,
            montoGravadoTotalOtraMoneda: montoGravadoTotalOtraMoneda ?? null,
            montoGravado1OtraMoneda: montoGravado1OtraMoneda ?? null,
            montoGravado2OtraMoneda: montoGravado2OtraMoneda ?? null,
            montoGravado3OtraMoneda: montoGravado3OtraMoneda ?? null,
            montoExentoOtraMoneda: montoExentoOtraMoneda ?? null,
            totalItbisOtraMoneda: totalItbisOtraMoneda ?? null,
            totalItbis1OtraMoneda: totalItbis1OtraMoneda ?? null,
            totalItbis2OtraMoneda: totalItbis2OtraMoneda ?? null,
            totalItbis3OtraMoneda: totalItbis3OtraMoneda ?? null,
            montoImpuestoAdicionalOtraMoneda: montoImpuestoAdicionalOtraMoneda ?? null,
            impuestosAdicionalesOtraMoneda: impuestosAdicionalesOtraMoneda || null,
            montoTotalOtraMoneda: montoTotalOtraMoneda ?? null,

            // Transporte + Info adicional
            ...mapTransporteFields(transporte),
            ...mapInfoAdicionalFields(informacionesAdicionales),

            // DT35 — <InformacionReferencia> (notas 33/34, FC 31 code 5, contingencia code 4)
            ...referenciFields
        }, { transaction: t });

        // 4.8. Crear líneas
        const lines = await InvoiceLine.bulkCreate(
            calculatedLines.map((line) => ({
                invoiceId: invoice.id,
                lineNumber: line.lineNumber,
                itemCode: line.itemCode,

                // 🔥 NUEVO (Step 3): campos DGII del <Item>
                itemName: line.itemName,
                description: line.description,
                indicadorBienoServicio: line.indicadorBienoServicio,
                unidadMedida: line.unidadMedida,
                recargo: line.recargo,
                cantidadReferencia: line.cantidadReferencia,
                unidadReferencia: line.unidadReferencia,
                gradosAlcohol: line.gradosAlcohol,
                precioUnitarioReferencia: line.precioUnitarioReferencia,
                fechaElaboracion: line.fechaElaboracion,
                fechaVencimientoItem: line.fechaVencimientoItem,

                // DT31
                additionalCodes: line.additionalCodes,
                subcantidades: line.subcantidades,
                subDescuentos: line.subDescuentos,
                subRecargos: line.subRecargos,
                impuestosAdicionales: line.impuestosAdicionales,
                pesoNetoKilogramo: line.pesoNetoKilogramo,
                pesoNetoMineria: line.pesoNetoMineria,
                tipoAfiliacion: line.tipoAfiliacion,
                liquidacion: line.liquidacion,

                // Cálculos
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount,
                itbisRate: line.itbisRate,
                itbisAmount: line.itbisAmount,
                indicadorFacturacion: line.indicadorFacturacion,
                total: line.total,

                // DT32 — a qué grupo de subtotal pertenece esta línea
                subtotalId: line.subtotalId,

                // Retención por línea (41, 47)
                retencionIndicador: line.retencion?.indicador ?? null,
                montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
            })),
            { transaction: t, returning: true }
        );

        // 4.8.1. DT32 — Crear subtotales
        // El cliente solo mandó metadata (numeroSubtotal, descripcion, orden).
        // Los montos se calculan aquí desde las líneas ya calculadas.
        let subtotalesCreados = [];
        if (Array.isArray(subtotales) && subtotales.length > 0) {
            // 1. Calcular montos desde las líneas (que ya tienen subtotalId)
            const subtotalesCalculados = calculateSubtotalsFromLines(
                subtotales,
                calculatedLines
            );

            // 2. Validar que cuadren con el total PRELIMINAR de la factura
            //    (pre-descuentos globales, porque los subtotales agrupan líneas
            //    y las líneas no llevan descuentos globales aplicados).
            assertSubtotalsMatchInvoiceTotal(subtotalesCalculados, invoiceTotalsPrelim.total);

            // 3. Persistir
            subtotalesCreados = await InvoiceSubtotal.bulkCreate(
                subtotalesCalculados.map((st) => ({
                    invoiceId: invoice.id,
                    numeroSubtotal: st.numeroSubtotal,
                    descripcion: st.descripcion,
                    orden: st.orden,
                    montoGravadoTotal: st.montoGravadoTotal,
                    montoGravadoI1: st.montoGravadoI1,
                    montoGravadoI2: st.montoGravadoI2,
                    montoGravadoI3: st.montoGravadoI3,
                    subTotalItbis: st.subTotalItbis,
                    subTotalItbis1: st.subTotalItbis1,
                    subTotalItbis2: st.subTotalItbis2,
                    subTotalItbis3: st.subTotalItbis3,
                    subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                    subTotalExento: st.subTotalExento,
                    montoSubTotal: st.montoSubTotal,
                    lineas: st.lineas
                })),
                { transaction: t, returning: true }
            );
        }

        // 4.8.2. DT33 — Crear descuentos/recargos globales
        let descuentosCreados = [];
        if (descuentosResueltos.length > 0) {
            descuentosCreados = await InvoiceDiscountCharge.bulkCreate(
                descuentosResueltos.map((d) => ({
                    invoiceId: invoice.id,
                    numeroLinea: d.numeroLinea,
                    tipoAjuste: d.tipoAjuste,
                    indicadorNorma1007: d.indicadorNorma1007 ?? null,
                    descripcion: d.descripcion || null,
                    tipoValor: d.tipoValor,
                    valor: d.tipoValor === '%' ? d.valor : null,
                    monto: d.monto,
                    montoOtraMoneda: d.montoOtraMoneda ?? null,
                    indicadorFacturacion: d.indicadorFacturacion
                })),
                { transaction: t, returning: true }
            );
        }


        // 4.8.5. 🔥 Generar y persistir XML
        // No rompemos la factura si el XML falla: xml_content queda null
        // y se puede regenerar con updateMyInvoice o un endpoint manual.
        try {
            const { generateAndSaveInvoiceXML } = require('../documents/xml/xml-integrator');
            await generateAndSaveInvoiceXML(invoice.id, t);
        } catch (xmlErr) {
            console.error('[createMyInvoice] XML generation failed:', xmlErr.message);
        }

        // 4.8.6. 🔥 DT39 — Generar RFCE si aplica (type=32 y total < 250K)
        // No rompemos la factura si falla: rfce_documents queda sin fila
        // y se puede regenerar con updateMyInvoice o un endpoint manual.
        try {
            const { generateAndSaveRFCE } = require('../documents/xml/xml-integrator');
            await generateAndSaveRFCE(invoice.id, t);
        } catch (rfceErr) {
            console.error('[createMyInvoice] RFCE generation failed:', rfceErr.message);
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
                    transportePaisDestino: invoice.transportePaisDestino || null,
                    // DT30 — resumen de campos nuevos que se guardaron
                    tipoPago: invoice.tipoPago ?? null,
                    tipoIngresos: invoice.tipoIngresos || null,
                    codigoVendedor: invoice.codigoVendedor || null,
                    tipoMoneda: invoice.tipoMoneda || null,
                    montoImpuestoAdicional: invoice.montoImpuestoAdicional ?? null,
                    // DT33 — descuentos/recargos globales
                    descuentosCount: descuentosCreados.length,
                    descuentosTotal: descuentosCreados.reduce(
                        (sum, d) => sum + Number(d.monto || 0), 0
                    )
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
            },
            {
                model: InvoiceSubtotal,
                as: 'subtotales',
                separate: true,
                order: [['numeroSubtotal', 'ASC']]
            },
            {
                model: InvoiceDiscountCharge,
                as: 'descuentosORecargos',
                separate: true,
                order: [['numeroLinea', 'ASC']]
            },
            {
                model: RfceDocument,
                as: 'rfce',
                required: false
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

    // 6.1. 🔥 DT39 — Guardar RFCE en disco si aplica (fire-and-forget)
    if (fullInvoice.rfce && fullInvoice.rfce.xmlContent) {
        const { saveXMLToDisk } = require('../documents/storage/xml-storage');
        saveXMLToDisk(
            { ...fullInvoice.toJSON(), ncf: `${fullInvoice.ncf}-RFCE` },
            fullInvoice.rfce.xmlContent
        ).catch(err => {
            console.error('[createMyInvoice] saveXMLToDisk (RFCE) failed:', err.message);
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

    // DT31 — Validaciones por tipo al actualizar items
    if (updates.items !== undefined) {
        // Retención: 31, 33, 34, 41, 47 permiten; 41 y 47 la exigen
        const tiposConRetencion = ['31', '33', '34', '41', '47'];
        const tiposQueExigenRetencion = ['41', '47'];

        for (let i = 0; i < updates.items.length; i++) {
            const item = updates.items[i];
            const hasRetencion = item.retencion !== undefined && item.retencion !== null;

            if (hasRetencion && !tiposConRetencion.includes(invoice.type)) {
                throw new AppError(
                    `Item ${i + 1}: retencion only applies to types 31, 33, 34, 41 and 47`,
                    409,
                    'RETENCION_NOT_ALLOWED'
                );
            }
            if (!hasRetencion && tiposQueExigenRetencion.includes(invoice.type)) {
                throw new AppError(
                    `Item ${i + 1}: retencion is required for types 41 and 47`,
                    409,
                    'RETENCION_REQUIRED'
                );
            }
        }

        // IndicadorFacturacion forzado por tipo
        if (['43', '44', '47'].includes(invoice.type)) {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorFacturacion ?? 4);
                if (ind !== 4) {
                    throw new AppError(
                        `Item ${i + 1}: type ${invoice.type} requires indicadorFacturacion=4 (Exento)`,
                        409,
                        'INDICADOR_FACTURACION_FORZADO'
                    );
                }
            }
        }
        if (invoice.type === '46') {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorFacturacion ?? 4);
                if (ind !== 3) {
                    throw new AppError(
                        `Item ${i + 1}: type 46 requires indicadorFacturacion=3 (ITBIS 0%)`,
                        409,
                        'INDICADOR_FACTURACION_FORZADO'
                    );
                }
            }
        }
        if (invoice.type === '47') {
            for (let i = 0; i < updates.items.length; i++) {
                const ind = Number(updates.items[i].indicadorBienoServicio ?? 1);
                if (ind !== 2) {
                    throw new AppError(
                        `Item ${i + 1}: type 47 requires indicadorBienoServicio=2 (Servicio)`,
                        409,
                        'INDICADOR_BIENO_SERVICIO_FORZADO'
                    );
                }
            }
        }
    }

    // B) e-CF 32: si el total final >= 250,000 requiere identificación (DGII)
    //    Resolvemos el estado FINAL: items del body o los de BD si no vienen.
    //    El total incluye recargo (Step 6): base = qty*price - discount + recargo
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
            const base = (Number(it.quantity) * Number(it.unitPrice))
                - Number(it.discount || 0)
                + Number(it.recargo || 0);
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
        modificationReason: invoice.modificationReason,
        tipoPago: invoice.tipoPago,
        tipoIngresos: invoice.tipoIngresos,
        codigoVendedor: invoice.codigoVendedor,
        terminoPago: invoice.terminoPago,
        tipoMoneda: invoice.tipoMoneda,
        tipoCambio: invoice.tipoCambio,
        descuentosCount: null,
        descuentosTotal: null
    };

    // DT33 — Cargar descuentos actuales para el `before` del audit
    try {
        const currentDescuentos = await InvoiceDiscountCharge.findAll({
            where: { invoiceId: invoice.id }
        });
        before.descuentosCount = currentDescuentos.length;
        before.descuentosTotal = roundMoney(
            currentDescuentos.reduce((sum, d) => sum + Number(d.monto || 0), 0)
        );
    } catch (err) {
        // No romper si falla la lectura de descuentos
        console.error('[updateMyInvoice] Failed to load current descuentos for audit:', err.message);
    }


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

        // ============================================================
        // DT30 — IdDoc extendido
        // ============================================================
        if (updates.indicadorEnvioDiferido !== undefined) updateData.indicadorEnvioDiferido = updates.indicadorEnvioDiferido ?? null;
        if (updates.indicadorMontoGravado !== undefined) updateData.indicadorMontoGravado = updates.indicadorMontoGravado ?? null;
        if (updates.indicadorServicioTodoIncluido !== undefined) updateData.indicadorServicioTodoIncluido = updates.indicadorServicioTodoIncluido ?? null;
        if (updates.tipoIngresos !== undefined) updateData.tipoIngresos = updates.tipoIngresos || null;
        if (updates.tipoPago !== undefined) updateData.tipoPago = updates.tipoPago ?? null;
        if (updates.fechaLimitePago !== undefined) updateData.fechaLimitePago = updates.fechaLimitePago ? new Date(updates.fechaLimitePago) : null;
        if (updates.terminoPago !== undefined) updateData.terminoPago = updates.terminoPago || null;
        if (updates.formasPago !== undefined) updateData.formasPago = updates.formasPago || null;
        if (updates.tipoCuentaPago !== undefined) updateData.tipoCuentaPago = updates.tipoCuentaPago || null;
        if (updates.numeroCuentaPago !== undefined) updateData.numeroCuentaPago = updates.numeroCuentaPago || null;
        if (updates.bancoPago !== undefined) updateData.bancoPago = updates.bancoPago || null;
        if (updates.fechaDesde !== undefined) updateData.fechaDesde = updates.fechaDesde ? new Date(updates.fechaDesde) : null;
        if (updates.fechaHasta !== undefined) updateData.fechaHasta = updates.fechaHasta ? new Date(updates.fechaHasta) : null;
        if (updates.totalPaginas !== undefined) updateData.totalPaginas = updates.totalPaginas ?? null;

        // ============================================================
        // DT30 — Emisor extendido
        // ============================================================
        if (updates.codigoVendedor !== undefined) updateData.codigoVendedor = updates.codigoVendedor || null;
        if (updates.numeroFacturaInterna !== undefined) updateData.numeroFacturaInterna = updates.numeroFacturaInterna || null;
        if (updates.numeroPedidoInterno !== undefined) updateData.numeroPedidoInterno = updates.numeroPedidoInterno || null;
        if (updates.zonaVenta !== undefined) updateData.zonaVenta = updates.zonaVenta || null;
        if (updates.rutaVenta !== undefined) updateData.rutaVenta = updates.rutaVenta || null;
        if (updates.informacionAdicionalEmisor !== undefined) updateData.informacionAdicionalEmisor = updates.informacionAdicionalEmisor || null;

        // ============================================================
        // DT30 — Comprador extendido
        // ============================================================
        if (updates.contactoComprador !== undefined) updateData.contactoComprador = updates.contactoComprador || null;
        if (updates.correoComprador !== undefined) updateData.correoComprador = updates.correoComprador || null;
        if (updates.direccionComprador !== undefined) updateData.direccionComprador = updates.direccionComprador || null;
        if (updates.municipioComprador !== undefined) updateData.municipioComprador = updates.municipioComprador || null;
        if (updates.provinciaComprador !== undefined) updateData.provinciaComprador = updates.provinciaComprador || null;
        if (updates.fechaEntrega !== undefined) updateData.fechaEntrega = updates.fechaEntrega ? new Date(updates.fechaEntrega) : null;
        if (updates.contactoEntrega !== undefined) updateData.contactoEntrega = updates.contactoEntrega || null;
        if (updates.direccionEntrega !== undefined) updateData.direccionEntrega = updates.direccionEntrega || null;
        if (updates.telefonoAdicional !== undefined) updateData.telefonoAdicional = updates.telefonoAdicional || null;
        if (updates.fechaOrdenCompra !== undefined) updateData.fechaOrdenCompra = updates.fechaOrdenCompra ? new Date(updates.fechaOrdenCompra) : null;
        if (updates.numeroOrdenCompra !== undefined) updateData.numeroOrdenCompra = updates.numeroOrdenCompra || null;
        if (updates.codigoInternoComprador !== undefined) updateData.codigoInternoComprador = updates.codigoInternoComprador || null;
        if (updates.responsablePago !== undefined) updateData.responsablePago = updates.responsablePago || null;
        if (updates.informacionAdicionalComprador !== undefined) updateData.informacionAdicionalComprador = updates.informacionAdicionalComprador || null;

        // ============================================================
        // DT30 — Info adicional extendido (pesos, bultos, ref)
        // ============================================================
        if (updates.numeroReferencia !== undefined) updateData.infoNumeroReferencia = updates.numeroReferencia || null;
        if (updates.pesoBruto !== undefined) updateData.infoPesoBruto = updates.pesoBruto ?? null;
        if (updates.pesoNeto !== undefined) updateData.infoPesoNeto = updates.pesoNeto ?? null;
        if (updates.unidadPesoBruto !== undefined) updateData.infoUnidadPesoBruto = updates.unidadPesoBruto ?? null;
        if (updates.unidadPesoNeto !== undefined) updateData.infoUnidadPesoNeto = updates.unidadPesoNeto ?? null;
        if (updates.cantidadBulto !== undefined) updateData.infoCantidadBulto = updates.cantidadBulto ?? null;
        if (updates.unidadBulto !== undefined) updateData.infoUnidadBulto = updates.unidadBulto ?? null;
        if (updates.volumenBulto !== undefined) updateData.infoVolumenBulto = updates.volumenBulto ?? null;
        if (updates.unidadVolumen !== undefined) updateData.infoUnidadVolumen = updates.unidadVolumen ?? null;

        // ============================================================
        // DT30 — Totales extendido
        // ============================================================
        if (updates.montoImpuestoAdicional !== undefined) updateData.montoImpuestoAdicional = updates.montoImpuestoAdicional ?? null;
        if (updates.impuestosAdicionales !== undefined) updateData.impuestosAdicionales = updates.impuestosAdicionales || null;
        if (updates.montoNoFacturable !== undefined) updateData.montoNoFacturable = updates.montoNoFacturable ?? null;
        if (updates.montoPeriodo !== undefined) updateData.montoPeriodo = updates.montoPeriodo ?? null;
        if (updates.saldoAnterior !== undefined) updateData.saldoAnterior = updates.saldoAnterior ?? null;
        if (updates.montoAvancePago !== undefined) updateData.montoAvancePago = updates.montoAvancePago ?? null;
        if (updates.valorPagar !== undefined) updateData.valorPagar = updates.valorPagar ?? null;
        if (updates.totalItbisPercepcion !== undefined) updateData.totalItbisPercepcion = updates.totalItbisPercepcion ?? null;
        if (updates.totalIsrPercepcion !== undefined) updateData.totalIsrPercepcion = updates.totalIsrPercepcion ?? null;

        // ============================================================
        // DT30 — OtraMoneda (encabezado)
        // ============================================================
        if (updates.tipoMoneda !== undefined) updateData.tipoMoneda = updates.tipoMoneda || null;
        if (updates.tipoCambio !== undefined) updateData.tipoCambio = updates.tipoCambio ?? null;
        if (updates.montoGravadoTotalOtraMoneda !== undefined) updateData.montoGravadoTotalOtraMoneda = updates.montoGravadoTotalOtraMoneda ?? null;
        if (updates.montoGravado1OtraMoneda !== undefined) updateData.montoGravado1OtraMoneda = updates.montoGravado1OtraMoneda ?? null;
        if (updates.montoGravado2OtraMoneda !== undefined) updateData.montoGravado2OtraMoneda = updates.montoGravado2OtraMoneda ?? null;
        if (updates.montoGravado3OtraMoneda !== undefined) updateData.montoGravado3OtraMoneda = updates.montoGravado3OtraMoneda ?? null;
        if (updates.montoExentoOtraMoneda !== undefined) updateData.montoExentoOtraMoneda = updates.montoExentoOtraMoneda ?? null;
        if (updates.totalItbisOtraMoneda !== undefined) updateData.totalItbisOtraMoneda = updates.totalItbisOtraMoneda ?? null;
        if (updates.totalItbis1OtraMoneda !== undefined) updateData.totalItbis1OtraMoneda = updates.totalItbis1OtraMoneda ?? null;
        if (updates.totalItbis2OtraMoneda !== undefined) updateData.totalItbis2OtraMoneda = updates.totalItbis2OtraMoneda ?? null;
        if (updates.totalItbis3OtraMoneda !== undefined) updateData.totalItbis3OtraMoneda = updates.totalItbis3OtraMoneda ?? null;
        if (updates.montoImpuestoAdicionalOtraMoneda !== undefined) updateData.montoImpuestoAdicionalOtraMoneda = updates.montoImpuestoAdicionalOtraMoneda ?? null;
        if (updates.impuestosAdicionalesOtraMoneda !== undefined) updateData.impuestosAdicionalesOtraMoneda = updates.impuestosAdicionalesOtraMoneda || null;
        if (updates.montoTotalOtraMoneda !== undefined) updateData.montoTotalOtraMoneda = updates.montoTotalOtraMoneda ?? null;

        // ============================================================
        // DT32 — Subtotales (update)
        //
        // Estrategia (espejo de DT33 descuentos):
        //   - Si vienen `items`: se recalculan las líneas, y los
        //     subtotales se recalculan desde esas líneas.
        //     (Se hace más abajo, después de reemplazar las líneas,
        //     porque necesitamos `calculatedLines`.)
        //   - Si NO vienen `items` pero SÍ `subtotales`: se recalculan
        //     los subtotales desde las líneas actuales de BD.
        //   - Si no vienen ni `items` ni `subtotales`: no se toca nada.
        //
        // Por eso aquí SOLO manejamos el caso "solo subtotales sin items".
        // El caso "items + subtotales" se maneja dentro del bloque de items.
        // ============================================================
        if (updates.items === undefined && updates.subtotales !== undefined) {
            // Cargar líneas actuales de BD
            const currentLines = await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']],
                transaction: t
            });

            // Reconstruir la estructura de "calculatedLines" desde BD
            const calculatedLinesFromDb = currentLines.map((l) => {
                const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
                return {
                    lineNumber: Number(raw.lineNumber),
                    itemCode: raw.itemCode,
                    itemName: raw.itemName,
                    description: raw.description,
                    indicadorBienoServicio: raw.indicadorBienoServicio,
                    unidadMedida: raw.unidadMedida,
                    recargo: raw.recargo,
                    cantidadReferencia: raw.cantidadReferencia,
                    unidadReferencia: raw.unidadReferencia,
                    gradosAlcohol: raw.gradosAlcohol,
                    precioUnitarioReferencia: raw.precioUnitarioReferencia,
                    fechaElaboracion: raw.fechaElaboracion,
                    fechaVencimientoItem: raw.fechaVencimientoItem,
                    additionalCodes: raw.additionalCodes,
                    subcantidades: raw.subcantidades,
                    subDescuentos: raw.subDescuentos,
                    subRecargos: raw.subRecargos,
                    impuestosAdicionales: raw.impuestosAdicionales,
                    pesoNetoKilogramo: raw.pesoNetoKilogramo,
                    pesoNetoMineria: raw.pesoNetoMineria,
                    tipoAfiliacion: raw.tipoAfiliacion,
                    liquidacion: raw.liquidacion,
                    quantity: Number(raw.quantity),
                    unitPrice: Number(raw.unitPrice),
                    discount: Number(raw.discount || 0),
                    itbisRate: Number(raw.itbisRate),
                    itbisAmount: Number(raw.itbisAmount),
                    indicadorFacturacion: Number(raw.indicadorFacturacion),
                    lineBase: roundMoney(
                        Number(raw.quantity) * Number(raw.unitPrice)
                        - Number(raw.discount || 0)
                        + Number(raw.recargo || 0)
                    ),
                    total: Number(raw.total),
                    subtotalId: raw.subtotalId
                };
            });

            // Reemplazar subtotales: destroy + calcular + bulkCreate
            await InvoiceSubtotal.destroy({
                where: { invoiceId: invoice.id },
                transaction: t
            });

            if (Array.isArray(updates.subtotales) && updates.subtotales.length > 0) {
                const subtotalesCalculados = calculateSubtotalsFromLines(
                    updates.subtotales,
                    calculatedLinesFromDb
                );

                // Validar contra el total preliminar (líneas actuales de BD)
                const invoiceTotalsPrelimFromDb = calculateInvoiceTotals(
                    calculatedLinesFromDb
                );
                assertSubtotalsMatchInvoiceTotal(
                    subtotalesCalculados,
                    invoiceTotalsPrelimFromDb.total
                );

                await InvoiceSubtotal.bulkCreate(
                    subtotalesCalculados.map((st) => ({
                        invoiceId: invoice.id,
                        numeroSubtotal: st.numeroSubtotal,
                        descripcion: st.descripcion,
                        orden: st.orden,
                        montoGravadoTotal: st.montoGravadoTotal,
                        montoGravadoI1: st.montoGravadoI1,
                        montoGravadoI2: st.montoGravadoI2,
                        montoGravadoI3: st.montoGravadoI3,
                        subTotalItbis: st.subTotalItbis,
                        subTotalItbis1: st.subTotalItbis1,
                        subTotalItbis2: st.subTotalItbis2,
                        subTotalItbis3: st.subTotalItbis3,
                        subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                        subTotalExento: st.subTotalExento,
                        montoSubTotal: st.montoSubTotal,
                        lineas: st.lineas
                    })),
                    { transaction: t }
                );
            }
        }

        // ============================================================
        // DT33 — Descuentos/recargos globales
        // Estrategia:
        //   - Si vienen items: recalculamos líneas (como antes) y
        //     recalculamos o reemplazamos los descuentos según el caso.
        //   - Si NO vienen items pero SÍ descuentos: recalculamos
        //     totales con las líneas actuales de BD.
        //   - Si no vienen ni items ni descuentos: no tocamos nada.
        // ============================================================

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

            // Totales preliminares (sin descuentos)
            const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

            // Resolver descuentos: si vienen del body, se usan; si no,
            // se cargan los existentes de BD y se recalculan sus montos.
            let descuentosResueltos = [];
            let reemplazarDescuentos = false;

            if (updates.descuentosORecargos !== undefined) {
                // El cliente mandó descuentos nuevos → reemplazar todos
                reemplazarDescuentos = true;
                descuentosResueltos = prepareDescuentos(
                    updates.descuentosORecargos,
                    invoiceTotalsPrelim
                );
            } else {
                // No mandó descuentos → recalcular los existentes con nuevas bases
                const existentes = await InvoiceDiscountCharge.findAll({
                    where: { invoiceId: invoice.id },
                    order: [['numeroLinea', 'ASC']],
                    transaction: t
                });
                descuentosResueltos = existentes.map(d => {
                    const raw = typeof d.toJSON === 'function' ? d.toJSON() : d;
                    return resolveDescuentoMonto(
                        {
                            numeroLinea: raw.numeroLinea,
                            tipoAjuste: raw.tipoAjuste,
                            indicadorNorma1007: raw.indicadorNorma1007,
                            descripcion: raw.descripcion,
                            tipoValor: raw.tipoValor,
                            valor: raw.valor,
                            monto: raw.monto,
                            montoOtraMoneda: raw.montoOtraMoneda,
                            indicadorFacturacion: raw.indicadorFacturacion
                        },
                        invoiceTotalsPrelim
                    );
                });
            }

            // Aplicar descuentos a los totales
            const invoiceTotals = applyDescuentosToTotals(
                invoiceTotalsPrelim,
                descuentosResueltos
            );

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

            // DT33 — ValorPagar: respetar el body, o calcular Norma1007
            // (solo si el cliente NO lo mandó explícitamente).
            if (updates.valorPagar === undefined) {
                updateData.valorPagar = calculateValorPagarNorma1007(
                    invoiceTotals.total,
                    descuentosResueltos
                );
            }

            // Reemplazar líneas
            await InvoiceLine.destroy({
                where: { invoiceId: invoice.id },
                transaction: t
            });

            await InvoiceLine.bulkCreate(
                calculatedLines.map((line) => ({
                    invoiceId: invoice.id,
                    lineNumber: line.lineNumber,
                    itemCode: line.itemCode,

                    // 🔥 NUEVO (Step 3): campos DGII del <Item>
                    itemName: line.itemName,
                    description: line.description,
                    indicadorBienoServicio: line.indicadorBienoServicio,
                    unidadMedida: line.unidadMedida,
                    recargo: line.recargo,
                    cantidadReferencia: line.cantidadReferencia,
                    unidadReferencia: line.unidadReferencia,
                    gradosAlcohol: line.gradosAlcohol,
                    precioUnitarioReferencia: line.precioUnitarioReferencia,
                    fechaElaboracion: line.fechaElaboracion,
                    fechaVencimientoItem: line.fechaVencimientoItem,

                    // DT31 — Sub-bloques del <Item>
                    additionalCodes: line.additionalCodes,
                    subcantidades: line.subcantidades,
                    subDescuentos: line.subDescuentos,
                    subRecargos: line.subRecargos,
                    impuestosAdicionales: line.impuestosAdicionales,
                    pesoNetoKilogramo: line.pesoNetoKilogramo,
                    pesoNetoMineria: line.pesoNetoMineria,
                    tipoAfiliacion: line.tipoAfiliacion,
                    liquidacion: line.liquidacion,

                    // Cálculos
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discount: line.discount,
                    itbisRate: line.itbisRate,
                    itbisAmount: line.itbisAmount,
                    indicadorFacturacion: line.indicadorFacturacion,
                    total: line.total,

                    // DT32 — a qué grupo de subtotal pertenece esta línea
                    subtotalId: line.subtotalId,

                    // Retención por línea (41, 47)
                    retencionIndicador: line.retencion?.indicador ?? null,
                    montoItbisRetenido: line.retencion?.montoItbisRetenido ?? null,
                    montoIsrRetenido: line.retencion?.montoIsrRetenido ?? null
                })),
                { transaction: t }
            );

            // Reemplazar o actualizar descuentos
            if (reemplazarDescuentos) {
                // El cliente mandó descuentos nuevos: destroy + bulkCreate
                await InvoiceDiscountCharge.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });
            }

            if (descuentosResueltos.length > 0) {
                if (reemplazarDescuentos) {
                    await InvoiceDiscountCharge.bulkCreate(
                        descuentosResueltos.map(d => ({
                            invoiceId: invoice.id,
                            numeroLinea: d.numeroLinea,
                            tipoAjuste: d.tipoAjuste,
                            indicadorNorma1007: d.indicadorNorma1007 ?? null,
                            descripcion: d.descripcion || null,
                            tipoValor: d.tipoValor,
                            valor: d.tipoValor === '%' ? d.valor : null,
                            monto: d.monto,
                            montoOtraMoneda: d.montoOtraMoneda ?? null,
                            indicadorFacturacion: d.indicadorFacturacion
                        })),
                        { transaction: t }
                    );
                } else {
                    // Recalcular monto de descuentos existentes (solo %)
                    for (const d of descuentosResueltos) {
                        await InvoiceDiscountCharge.update(
                            { monto: d.monto },
                            {
                                where: {
                                    invoiceId: invoice.id,
                                    numeroLinea: d.numeroLinea
                                },
                                transaction: t
                            }
                        );
                    }
                }
            } else if (reemplazarDescuentos) {
                // El cliente mandó descuentosORecargos = [] (vacío) → borrar todos
                // (ya se hizo el destroy arriba)
            }
            // ============================================================
            // DT32 — Subtotales cuando vienen items
            //
            // Si el cliente mandó `subtotales`, se reemplazan todos.
            // Si NO mandó `subtotales`, se recalculan los existentes
            // desde las nuevas líneas (para mantener consistencia de montos).
            // ============================================================
            if (updates.subtotales !== undefined) {
                // El cliente mandó subtotales nuevos → destroy + bulkCreate
                await InvoiceSubtotal.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });

                if (Array.isArray(updates.subtotales) && updates.subtotales.length > 0) {
                    const subtotalesCalculados = calculateSubtotalsFromLines(
                        updates.subtotales,
                        calculatedLines
                    );

                    assertSubtotalsMatchInvoiceTotal(
                        subtotalesCalculados,
                        invoiceTotalsPrelim.total
                    );

                    await InvoiceSubtotal.bulkCreate(
                        subtotalesCalculados.map((st) => ({
                            invoiceId: invoice.id,
                            numeroSubtotal: st.numeroSubtotal,
                            descripcion: st.descripcion,
                            orden: st.orden,
                            montoGravadoTotal: st.montoGravadoTotal,
                            montoGravadoI1: st.montoGravadoI1,
                            montoGravadoI2: st.montoGravadoI2,
                            montoGravadoI3: st.montoGravadoI3,
                            subTotalItbis: st.subTotalItbis,
                            subTotalItbis1: st.subTotalItbis1,
                            subTotalItbis2: st.subTotalItbis2,
                            subTotalItbis3: st.subTotalItbis3,
                            subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                            subTotalExento: st.subTotalExento,
                            montoSubTotal: st.montoSubTotal,
                            lineas: st.lineas
                        })),
                        { transaction: t }
                    );
                }
            } else {
                // No mandó subtotales: recalcular los existentes desde las nuevas líneas
                const existentes = await InvoiceSubtotal.findAll({
                    where: { invoiceId: invoice.id },
                    order: [['numeroSubtotal', 'ASC']],
                    transaction: t
                });

                if (existentes.length > 0) {
                    const inputExistentes = existentes.map((s) => {
                        const raw = typeof s.toJSON === 'function' ? s.toJSON() : s;
                        return {
                            numeroSubtotal: Number(raw.numeroSubtotal),
                            descripcion: raw.descripcion,
                            orden: raw.orden
                        };
                    });

                    const subtotalesCalculados = calculateSubtotalsFromLines(
                        inputExistentes,
                        calculatedLines
                    );

                    assertSubtotalsMatchInvoiceTotal(
                        subtotalesCalculados,
                        invoiceTotalsPrelim.total
                    );

                    // Actualizar montos de los existentes (lineas y montos)
                    for (const st of subtotalesCalculados) {
                        await InvoiceSubtotal.update(
                            {
                                montoGravadoTotal: st.montoGravadoTotal,
                                montoGravadoI1: st.montoGravadoI1,
                                montoGravadoI2: st.montoGravadoI2,
                                montoGravadoI3: st.montoGravadoI3,
                                subTotalItbis: st.subTotalItbis,
                                subTotalItbis1: st.subTotalItbis1,
                                subTotalItbis2: st.subTotalItbis2,
                                subTotalItbis3: st.subTotalItbis3,
                                subTotalImpuestoAdicional: st.subTotalImpuestoAdicional,
                                subTotalExento: st.subTotalExento,
                                montoSubTotal: st.montoSubTotal,
                                lineas: st.lineas
                            },
                            {
                                where: {
                                    invoiceId: invoice.id,
                                    numeroSubtotal: st.numeroSubtotal
                                },
                                transaction: t
                            }
                        );
                    }
                }
            }
        }




        // Caso B: NO vienen items, pero SÍ descuentos → recalcular totales
        // con las líneas actuales de BD.
        if (updates.items === undefined && updates.descuentosORecargos !== undefined) {
            // Cargar líneas actuales de BD
            const currentLines = await InvoiceLine.findAll({
                where: { invoiceId: invoice.id },
                order: [['lineNumber', 'ASC']],
                transaction: t
            });

            if (currentLines.length > 0) {
                // Convertir a la estructura que calculateInvoiceTotals espera
                const calculatedLines = currentLines.map(l => {
                    const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
                    return {
                        quantity: Number(raw.quantity),
                        unitPrice: Number(raw.unitPrice),
                        discount: Number(raw.discount || 0),
                        recargo: Number(raw.recargo || 0),
                        itbisRate: Number(raw.itbisRate),
                        itbisAmount: Number(raw.itbisAmount),
                        indicadorFacturacion: Number(raw.indicadorFacturacion),
                        lineBase: roundMoney(
                            Number(raw.quantity) * Number(raw.unitPrice)
                            - Number(raw.discount || 0)
                            + Number(raw.recargo || 0)
                        ),
                        total: Number(raw.total)
                    };
                });

                const invoiceTotalsPrelim = calculateInvoiceTotals(calculatedLines);

                const descuentosResueltos = prepareDescuentos(
                    updates.descuentosORecargos,
                    invoiceTotalsPrelim
                );

                const invoiceTotals = applyDescuentosToTotals(
                    invoiceTotalsPrelim,
                    descuentosResueltos
                );

                updateData.subtotal = invoiceTotals.subtotal;
                updateData.itbis = invoiceTotals.itbis;
                updateData.total = invoiceTotals.total;
                updateData.montoGravado = invoiceTotals.montoGravado;
                updateData.itbis1Base = invoiceTotals.itbis1Base;
                updateData.itbis1Amount = invoiceTotals.itbis1Amount;
                updateData.itbis2Base = invoiceTotals.itbis2Base;
                updateData.itbis2Amount = invoiceTotals.itbis2Amount;
                updateData.exemptAmount = invoiceTotals.exemptAmount || null;

                // DT33 — ValorPagar: respetar el body, o calcular Norma1007
                if (updates.valorPagar === undefined) {
                    updateData.valorPagar = calculateValorPagarNorma1007(
                        invoiceTotals.total,
                        descuentosResueltos
                    );
                }

                // Reemplazar descuentos
                await InvoiceDiscountCharge.destroy({
                    where: { invoiceId: invoice.id },
                    transaction: t
                });

                if (descuentosResueltos.length > 0) {
                    await InvoiceDiscountCharge.bulkCreate(
                        descuentosResueltos.map(d => ({
                            invoiceId: invoice.id,
                            numeroLinea: d.numeroLinea,
                            tipoAjuste: d.tipoAjuste,
                            indicadorNorma1007: d.indicadorNorma1007 ?? null,
                            descripcion: d.descripcion || null,
                            tipoValor: d.tipoValor,
                            valor: d.tipoValor === '%' ? d.valor : null,
                            monto: d.monto,
                            montoOtraMoneda: d.montoOtraMoneda ?? null,
                            indicadorFacturacion: d.indicadorFacturacion
                        })),
                        { transaction: t }
                    );
                }
            }
        }

        // ============================================================
        // DT35 — Campos editables de <InformacionReferencia>
        //
        // En update SOLO se permite editar:
        //   - modificationCode
        //   - modificationReason (solo 33/34)
        //
        // La validación de qué código aplica al TIPO REAL de la factura
        // se hace aquí (Joi no conoce el type porque no viene en el body).
        //
        // Matriz de códigos permitidos por tipo:
        //   31 → 4, 5
        //   32 → 4
        //   33 → 1, 2, 3, 4
        //   34 → 1, 2, 3, 4
        //   41, 43, 44, 45, 46, 47 → 4
        // ============================================================
        if (updates.modificationCode !== undefined) {
            const CODIGOS_PERMITIDOS_POR_TIPO = {
                '31': [4, 5],
                '32': [4],
                '33': [1, 2, 3, 4],
                '34': [1, 2, 3, 4],
                '41': [4],
                '43': [4],
                '44': [4],
                '45': [4],
                '46': [4],
                '47': [4]
            };

            const code = Number(updates.modificationCode);
            const permitidos = CODIGOS_PERMITIDOS_POR_TIPO[String(invoice.type)] || [];

            if (permitidos.length === 0) {
                throw new AppError(
                    `Tipo ${invoice.type}: CodigoModificacion no aplica a este tipo de e-CF`,
                    409,
                    'MODIFICATION_CODE_NOT_ALLOWED'
                );
            }

            if (!permitidos.includes(code)) {
                throw new AppError(
                    `Tipo ${invoice.type}: CodigoModificacion=${code} no permitido. ` +
                    `Valores permitidos: [${permitidos.join(', ')}]. ` +
                    `Recuerda: 1, 2, 3 solo aplican a Notas (33/34); 5 solo aplica a FC Fiscal (31).`,
                    409,
                    'MODIFICATION_CODE_NOT_ALLOWED_FOR_TYPE'
                );
            }

            // El original debe existir en BD para 33/34 y para 31 con code 5.
            // Para code 4, si no existe en BD, es porque es papel (permitido).
            const requiresOriginalExists =
                invoice.type === '33' ||
                invoice.type === '34' ||
                (invoice.type === '31' && code === 5);

            if (requiresOriginalExists && !invoice.modifiedNcf) {
                throw new AppError(
                    `Tipo ${invoice.type}: no puedes cambiar CodigoModificacion sin NCFModificado previo`,
                    409,
                    'MODIFICATION_CODE_WITHOUT_NCF'
                );
            }

            updateData.modificationCode = code;
        }

        if (updates.modificationReason !== undefined) {
            // RazonModificacion solo aplica a 33/34
            if (invoice.type !== '33' && invoice.type !== '34') {
                throw new AppError(
                    `Tipo ${invoice.type}: RazonModificacion solo aplica a Notas (33/34)`,
                    409,
                    'RAZON_MODIFICACION_NOT_ALLOWED'
                );
            }
            updateData.modificationReason = updates.modificationReason || null;
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


        // 4.3.6. 🔥 DT39 — Regenerar RFCE si aplica (y si sigue siendo draft)
        if (invoice.status === 'draft'
            && invoice.type === '32'
            && Number(invoice.total) < 250000) {
            try {
                const { generateAndSaveRFCE } = require('../documents/xml/xml-integrator');
                await generateAndSaveRFCE(invoice.id, t);
            } catch (rfceErr) {
                console.error('[updateMyInvoice] RFCE regen failed:', rfceErr.message);
            }
        }


        // 4.4. Audit log
        // 4.4. Audit log (enriquecido con snapshot de descuentos)
        try {
            // Snapshot de descuentos actuales (post-update) para el `after`
            const descuentosAfter = await InvoiceDiscountCharge.findAll({
                where: { invoiceId: invoice.id },
                transaction: t
            });
            const descuentosAfterCount = descuentosAfter.length;
            const descuentosAfterTotal = roundMoney(
                descuentosAfter.reduce((sum, d) => sum + Number(d.monto || 0), 0)
            );

            const after = {
                ...updateData,
                // DT33 — snapshot de descuentos después del update
                descuentosCount: descuentosAfterCount,
                descuentosTotal: descuentosAfterTotal
            };

            await AuditLog.create({
                companyId,
                userId: reqUser?.id ?? null,
                action: 'invoice.updated',
                entity: 'invoice',
                entityId: invoice.id,
                before,
                after,
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
            },
            {
                model: InvoiceSubtotal,
                as: 'subtotales',
                separate: true,
                order: [['numeroSubtotal', 'ASC']]
            },
            {
                model: InvoiceDiscountCharge,
                as: 'descuentosORecargos',
                separate: true,
                order: [['numeroLinea', 'ASC']]
            },
            {
                model: RfceDocument,
                as: 'rfce',
                required: false
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
                attributes: [
                    'id', 'rnc', 'name', 'tradeName',
                    'email', 'phone', 'address', 'economicActivity',
                    'dgiiEnvironment', 'isActive',
                    'provinceDgiiCode', 'municipalityDgiiCode',
                    'sucursal', 'website', 'additionalPhones'
                ]
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
            },
            {
                model: InvoiceSubtotal,
                as: 'subtotales',
                separate: true,
                order: [['numeroSubtotal', 'ASC']]
            },
            {
                model: InvoiceDiscountCharge,
                as: 'descuentosORecargos',
                separate: true,
                order: [['numeroLinea', 'ASC']]
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
                attributes: ['id', 'rnc', 'name', 'tradeName', 'email', 'phone', 'address', 'economicActivity'],
                include: [{
                    model: CompanyLogo,
                    as: 'logos',
                    where: { purpose: 'invoice' },
                    required: false,
                    attributes: ['id', 'purpose', 'secureUrl', 'format', 'width', 'height']
                }]
            },
            {
                model: InvoiceSubtotal,
                as: 'subtotales',
                separate: true,
                order: [['numeroSubtotal', 'ASC']]
            },
            {
                model: InvoiceDiscountCharge,
                as: 'descuentosORecargos',
                separate: true,
                order: [['numeroLinea', 'ASC']]
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
        resolveModifiedInvoice,
        // DT32 — subtotales
        calculateSubtotalsFromLines,
        assertSubtotalsMatchInvoiceTotal
    }
};

