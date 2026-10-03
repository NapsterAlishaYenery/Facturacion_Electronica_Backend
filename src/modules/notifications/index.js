// ============================================================
// Notifications module — barrel público
// Todo el resto de la app importa SOLO desde aquí:
//
//     const notifications = require('../notifications');
//     await notifications.sendPasswordReset({ ... });
//
// Nunca importar adapters/ o templates/ directamente.
// ============================================================

const service = require('./notifications.service');

module.exports = service;