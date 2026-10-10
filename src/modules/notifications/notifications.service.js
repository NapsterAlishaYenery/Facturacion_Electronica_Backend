// ============================================================
// Notifications service — API pública del módulo
//
// Orquesta:
//   1. Toma el template correspondiente (templates/index.js)
//   2. Renderiza el contenido ({ html, text })
//   3. Envía por el canal elegido (adapters/index.js)
//
// El resto de la app NUNCA importa adapters/ ni templates/
// directamente. Solo llama funciones de este archivo.
//
// Convención por función:
//   send<TemplateName>({ to, ...templateData }) → info del adapter
// ============================================================

const { getAdapter } = require('./adapters');
const templates = require('./templates');

// ------------------------------------------------------------
// sendPasswordResetCode — enviar código de recuperación (6 dígitos)
//
// Uso:
//   await notifications.sendPasswordResetCode({
//       to: user.email,
//       name: user.firstName,
//       code: '123456'
//   });
// ------------------------------------------------------------
async function sendPasswordResetCode({ to, name, code, expiresInMinutes }) {
    // 1. Renderizar el template
    const tpl = templates.passwordResetCode;
    const { html, text } = tpl.render({ name, code, expiresInMinutes });

    // 2. Enviar por el canal email
    const adapter = getAdapter('email');
    return adapter.send({
        to,
        subject: tpl.subject,
        html,
        text
    });
}

// ------------------------------------------------------------
// sendWelcome — correo de bienvenida al dueño de empresa nueva
// ------------------------------------------------------------
async function sendWelcome({ to, name, companyName, rnc, planName, trialDays }) {
    // 1. Renderizar el template
    const tpl = templates.welcome;
    const { html, text } = tpl.render({ name, companyName, rnc, planName, trialDays });

    // 2. Enviar
    const adapter = getAdapter('email');
    return adapter.send({
        to,
        subject: tpl.subject,
        html,
        text
    });
}

// ------------------------------------------------------------
// sendNewCompanyAlert — correo interno a Expedinap
// ------------------------------------------------------------
async function sendNewCompanyAlert({ to, company, owner, subscription, plan, meta }) {
    // 1. Renderizar el template
    const tpl = templates.newCompanyAlert;
    const { html, text } = tpl.render({ company, owner, subscription, plan, meta });

    // 2. Subject dinámico (incluye nombre de empresa)
    const subject = tpl.buildSubject({ company });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// sendPasswordReset — confirmación al usuario tras cambiar la clave
// ------------------------------------------------------------
async function sendPasswordReset({ to, name, when, ip }) {
    // 1. Renderizar el template
    const tpl = templates.passwordReset;
    const { html, text } = tpl.render({ name, when, ip });

    // 2. Enviar
    const adapter = getAdapter('email');
    return adapter.send({
        to,
        subject: tpl.subject,
        html,
        text
    });
}

// ------------------------------------------------------------
// sendNewUser — bienvenida al usuario recién creado
// ------------------------------------------------------------
async function sendNewUser({ to, name, email, password, companyName, loginUrl }) {
    // 1. Renderizar el template
    const tpl = templates.newUser;
    const { html, text } = tpl.render({ name, email, password, companyName, loginUrl });

    // 2. Subject dinámico (depende de si tiene empresa)
    const subject = tpl.buildSubject({ companyName });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// sendUserStatusChanged — confirmación al ejecutor tras
// desactivar o eliminar un usuario
// ------------------------------------------------------------
async function sendUserStatusChanged({ to, action, targetUser, companyName, executor }) {
    // 1. Renderizar el template
    const tpl = templates.userStatusChanged;
    const { html, text } = tpl.render({ action, targetUser, companyName, executor });

    // 2. Subject dinámico
    const subject = tpl.buildSubject({ action, targetUser });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// sendCertificateExpiring — aviso de certificado por vencer/vencido
// ------------------------------------------------------------
async function sendCertificateExpiring({
    to,
    bcc,
    companyName,
    rnc,
    ownerName,
    expiresAt,
    daysLeft,
    expired
}) {
    // 1. Renderizar el template
    const tpl = templates.certificateExpiring;
    const { html, text } = tpl.render({
        companyName,
        rnc,
        ownerName,
        expiresAt,
        daysLeft,
        expired
    });

    // 2. Subject dinámico
    const subject = tpl.buildSubject({ companyName, daysLeft, expired });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendSequencesAlert — aviso agrupado de secuencias con problemas
// ------------------------------------------------------------
async function sendSequencesAlert({ to, bcc, companyName, rnc, ownerName, reason, sequences }) {
    // 1. Renderizar el template
    const tpl = templates.sequencesAlert;
    const { html, text } = tpl.render({ companyName, rnc, ownerName, reason, sequences });

    // 2. Subject dinámico
    const subject = tpl.buildSubject({ companyName, count: sequences.length, reason });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendSubscriptionExpiring — aviso preventivo de vencimiento
// ------------------------------------------------------------
async function sendSubscriptionExpiring({
    to,
    bcc,
    companyName,
    rnc,
    ownerName,
    status,
    planName,
    expiresAt,
    daysLeft
}) {
    // 1. Renderizar el template
    const tpl = templates.subscriptionExpiring;
    const { html, text } = tpl.render({
        companyName,
        rnc,
        ownerName,
        status,
        planName,
        expiresAt,
        daysLeft
    });

    // 2. Subject dinámico
    const subject = tpl.buildSubject({ companyName, status, planName, daysLeft });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendInvoiceRejected — alerta interna cuando una factura se
// rechaza definitivamente tras agotar reintentos de envío
// ------------------------------------------------------------
async function sendInvoiceRejected({ to, invoice, company, attempts, error }) {
    // 1. Renderizar el template
    const tpl = templates.invoiceRejected;
    const { html, text } = tpl.render({ invoice, company, attempts, error });

    // 2. Subject dinámico
    const subject = tpl.buildSubject({ invoice, company });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// sendInvoiceAccepted — notifica que la DGII aceptó una factura
// ------------------------------------------------------------
async function sendInvoiceAccepted({ to, bcc, invoice, company }) {
    // 1. Renderizar el template
    const tpl = templates.invoiceAccepted;
    const { html, text } = tpl.render({ invoice, company });

    // 2. Subject
    const subject = tpl.buildSubject({ invoice, company });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendInvoiceRejectedByDgii — notifica que la DGII rechazó una factura
// ------------------------------------------------------------
async function sendInvoiceRejectedByDgii({ to, bcc, invoice, company, reason }) {
    // 1. Renderizar el template
    const tpl = templates.invoiceRejectedByDgii;
    const { html, text } = tpl.render({ invoice, company, reason });

    // 2. Subject
    const subject = tpl.buildSubject({ invoice, company });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendNoActiveSequence — alerta urgente cuando no hay secuencia NCF
// disponible para emitir una factura del tipo solicitado
// ------------------------------------------------------------
async function sendNoActiveSequence({
    to,
    bcc,
    companyName,
    rnc,
    ownerName,
    type,
    typeName,
    attemptedAt
}) {
    // 1. Renderizar el template
    const tpl = templates.noActiveSequence;
    const { html, text } = tpl.render({
        companyName,
        rnc,
        ownerName,
        type,
        typeName,
        attemptedAt
    });

    // 2. Subject
    const subject = tpl.buildSubject({ type, typeName, companyName });

    // 3. Enviar
    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendPaymentPending — aviso al cliente de un pago pendiente
// ------------------------------------------------------------
async function sendPaymentPending({
    to,
    bcc,
    companyName,
    rnc,
    ownerName,
    planName,
    amount,
    currency,
    periodStart,
    periodEnd,
    paymentDueAt
}) {
    const tpl = templates.paymentPending;
    const { html, text } = tpl.render({
        companyName,
        rnc,
        ownerName,
        planName,
        amount,
        currency,
        periodStart,
        periodEnd,
        paymentDueAt
    });

    const subject = tpl.buildSubject({ companyName, planName });

    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// sendPaymentPendingAlert — resumen interno a Expedinap
// ------------------------------------------------------------
async function sendPaymentPendingAlert({
    to,
    company,
    owner,
    plan,
    amount,
    currency,
    periodStart,
    periodEnd,
    paymentDueAt
}) {
    const tpl = templates.paymentPendingAlert;
    const { html, text } = tpl.render({
        company,
        owner,
        plan,
        amount,
        currency,
        periodStart,
        periodEnd,
        paymentDueAt
    });

    const subject = tpl.buildSubject({
        companyName: company?.name,
        planName: plan?.name,
        amount,
        currency
    });

    const adapter = getAdapter('email');
    return adapter.send({ to, subject, html, text });
}

// ------------------------------------------------------------
// sendPaymentReceived — comprobante de pago al cliente
// ------------------------------------------------------------
async function sendPaymentReceived({
    to,
    bcc,
    companyName,
    rnc,
    ownerName,
    planName,
    amount,
    currency,
    paymentMethod,
    reference,
    periodStart,
    periodEnd,
    paidAt
}) {
    const tpl = templates.paymentReceived;
    const { html, text } = tpl.render({
        companyName,
        rnc,
        ownerName,
        planName,
        amount,
        currency,
        paymentMethod,
        reference,
        periodStart,
        periodEnd,
        paidAt
    });

    const subject = tpl.buildSubject({ companyName, planName });

    const adapter = getAdapter('email');
    return adapter.send({ to, bcc, subject, html, text });
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = {
    sendPasswordResetCode,
    sendPasswordReset, 
    sendWelcome,
    sendNewCompanyAlert,
    sendNewUser,
    sendUserStatusChanged,
    sendCertificateExpiring,
    sendSequencesAlert,
    sendSubscriptionExpiring,
    sendInvoiceRejected,
    sendInvoiceAccepted,
    sendInvoiceRejectedByDgii,
    sendNoActiveSequence,
    sendPaymentPending,
    sendPaymentPendingAlert,
    sendPaymentReceived
};