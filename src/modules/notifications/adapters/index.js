// ============================================================
// Adapter factory — resuelve el canal al adapter correspondiente
//
// Hoy: 'email'.
// Futuro: 'whatsapp', 'push' → sin tocar notifications.service.js.
// ============================================================

const emailAdapter = require('./email.adapter');

// ------------------------------------------------------------
// Registro de adapters disponibles
// ------------------------------------------------------------
const adapters = {
    email: emailAdapter
    // whatsapp: require('./whatsapp.adapter'),  // ← futuro
    // push: require('./push.adapter')            // ← futuro
};

// ------------------------------------------------------------
// getAdapter — devuelve el adapter del canal o lanza error
// ------------------------------------------------------------
function getAdapter(channel) {
    const adapter = adapters[channel];
    if (!adapter) {
        throw new Error(`Notification adapter not supported: ${channel}`);
    }
    return adapter;
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { getAdapter };