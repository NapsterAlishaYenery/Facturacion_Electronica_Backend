// ============================================================
// Adapter factory — resuelve el canal al adapter correspondiente
// Hoy: solo 'email'. Mañana: 'whatsapp', 'push' sin tocar service.
// ============================================================

const adapters = {
  // email: require('./email.adapter'),  // ← Paso 3
};

function getAdapter(channel) {
  const adapter = adapters[channel];
  if (!adapter) {
    throw new Error(`Notification adapter not supported: ${channel}`);
  }
  return adapter;
}

module.exports = { getAdapter };