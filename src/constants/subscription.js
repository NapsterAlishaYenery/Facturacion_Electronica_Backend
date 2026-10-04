// ============================================================
// Constantes de suscripción
//
// Fuente de verdad para todos los números relacionados con
// trials y períodos. Cambiar aquí aplica en:
//   - auth.service.registerCompany (creación de trial)
//   - templates/welcome (menciona el período)
//   - jobs de suscripciones (evaluación de vencimiento)
// ============================================================

module.exports = {
    // Días de prueba gratuita al registrar una empresa nueva
    TRIAL_DAYS: 25,

    // Días de gracia después del vencimiento antes de expirar
    GRACE_DAYS: 3
};