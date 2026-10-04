// ============================================================
// Notifications module — barrel público
//
// Todo el resto de la app importa SOLO desde aquí:
//
//     const notifications = require('../modules/notifications');
//     await notifications.sendPasswordResetCode({ ... });
//
// Regla: NUNCA importar adapters/ o templates/ directamente
// desde fuera de este módulo. Solo este barrel es la API.
// ============================================================

const service = require('./notifications.service');

module.exports = service;