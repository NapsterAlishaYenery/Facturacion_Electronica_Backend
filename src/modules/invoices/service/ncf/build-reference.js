// ============================================================
// build-reference.js
// DT35 — <InformacionReferencia>
// Resuelve la factura original que modifica el e-CF que se
// está emitiendo.
//
// TRANSACCIONAL — se llama dentro de la tx para bloquear la fila.
//
// Reglas por tipo:
//   - 33 y 34 (Notas):
//       SIEMPRE requieren original. El original debe ser 31 o 32,
//       estar sent/accepted, y no tener ya una nota activa.
//   - 31 con modificationCode = 5 (Referencia FC):
//       Requiere original. El original DEBE ser 32 (FC Consumo),
//       estar sent/accepted, y no tener ya una referencia activa
//       desde otro 31.
//   - Cualquier tipo con modificationCode = 4 (Reemplazo contingencia):
//       Requiere intentar buscar el original. Si existe en BD, se
//       valida que su tipo sea equivalente al tipo emitido. Si NO
//       existe (porque es un NCF de papel emitido en contingencia),
//       se permite y solo se valida el formato del NCF de papel.
//   - Resto de combinaciones (tipo != 33/34 y sin code 4/5):
//       NO requiere original. Retorna null.
// ============================================================

const { Op } = require('sequelize');
const { Invoice } = require('../../../../models');
const { AppError } = require('../../../../shared/middlewares/error.middleware');

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

module.exports = { resolveModifiedInvoice };