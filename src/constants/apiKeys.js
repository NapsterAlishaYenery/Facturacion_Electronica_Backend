// ============================================================
// Constantes del módulo API Keys (FASE 18)
// ============================================================

module.exports = {
    // Límite de keys activas por empresa (independiente del plan;
    // enterprise también tiene tope de 10 para evitar abuso).
    MAX_ACTIVE_KEYS_PER_COMPANY: 10,

    // Prefijos visibles según ambiente
    PREFIX_LIVE: 'pk_live_',
    PREFIX_TEST: 'pk_test_',

    // Longitud del secret en bytes (32 bytes = 64 hex chars)
    SECRET_BYTES: 32,

    // Cuántos chars del secret se guardan como prefix visible
    // "pk_live_" (8) + 6 hex = 14 chars totales (cabe en VARCHAR(20))
    PREFIX_VISIBLE_CHARS: 6,

    // Rate limit específico por API Key (requests por minuto)
    get RATE_LIMIT_PER_MIN() {
        const envVal = Number(process.env.API_KEY_RATE_LIMIT_PER_MIN);
        return Number.isFinite(envVal) && envVal > 0 ? envVal : 1000;
    }
};