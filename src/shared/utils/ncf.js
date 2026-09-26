// ============================================================
// Utilidades para construir y parsear e-NCF
// ============================================================

// ------------------------------------------------------------
// Construir e-NCF completo desde sus partes
// Formato: E + tipo(2) + secuencial(10 dígitos con ceros)
// Ejemplo: buildNCF('E', '32', 5) → 'E320000000005'
// ------------------------------------------------------------
function buildNCF(prefix, type, sequential) {
    const seqString = String(sequential).padStart(10, '0');
    return `${prefix}${type}${seqString}`;
}

// ------------------------------------------------------------
// Parsear un e-NCF completo en sus partes
// Ejemplo: parseNCF('E320000000005') → { prefix: 'E', type: '32', sequential: 5 }
// ------------------------------------------------------------
function parseNCF(ncf) {
    if (!ncf || ncf.length !== 13) {
        throw new Error('Invalid NCF format');
    }

    const prefix = ncf.substring(0, 1);
    const type = ncf.substring(1, 3);
    const sequential = parseInt(ncf.substring(3, 13), 10);

    return { prefix, type, sequential };
}

// ------------------------------------------------------------
// Validar formato de e-NCF
// ------------------------------------------------------------
function isValidNCF(ncf) {
    if (!ncf || typeof ncf !== 'string') return false;
    return /^E\d{12}$/.test(ncf);
}

module.exports = {
    buildNCF,
    parseNCF,
    isValidNCF
};