// ============================================================
// Asociaciones entre modelos
// Este archivo define TODAS las relaciones del sistema
// Debe importarse una sola vez en server.js para que Sequelize
// las registre antes de cualquier query
// ============================================================

const Company = require('./company.model');
const Plan = require('./plan.model');
const Subscription = require('./subscription.model');
const SubscriptionPayment = require('./subscriptionPayment.model');
const User = require('./user.model');
const Sequence = require('./sequence.model');
const Invoice = require('./invoice.model');
const InvoiceLine = require('./invoiceLine.model');
const AuditLog = require('./auditLog.model');
const PasswordReset = require('./passwordReset.model');
const CompanyLogo = require('./companyLogo.model');
const Product = require('./product.model');
const ApiKey = require('./apiKey.model');

// ============================================================
// Company (1) ─── (N) Subscription
// FK: subscriptions.company_id → companies.id (CASCADE)
// ============================================================
Company.hasMany(Subscription, {
    foreignKey: 'companyId',
    as: 'subscriptions',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
Subscription.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Plan (1) ─── (N) Subscription
// FK: subscriptions.plan_id → plans.id (RESTRICT)
// ============================================================
Plan.hasMany(Subscription, {
    foreignKey: 'planId',
    as: 'subscriptions',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
});
Subscription.belongsTo(Plan, {
    foreignKey: 'planId',
    as: 'plan'
});

// ============================================================
// Subscription (1) ─── (N) SubscriptionPayment
// FK: subscription_payments.subscription_id → subscriptions.id (CASCADE)
// ============================================================
Subscription.hasMany(SubscriptionPayment, {
    foreignKey: 'subscriptionId',
    as: 'payments',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
SubscriptionPayment.belongsTo(Subscription, {
    foreignKey: 'subscriptionId',
    as: 'subscription'
});

// ============================================================
// SubscriptionPayment (N) ─── (1) Invoice
// FK: subscription_payments.invoice_id → invoices.id (SET NULL)
// Representa la factura emitida por ExpediNap al cliente por
// el pago de la membresía.
// ============================================================
Invoice.hasMany(SubscriptionPayment, {
    foreignKey: 'invoiceId',
    as: 'membershipPayments',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});
SubscriptionPayment.belongsTo(Invoice, {
    foreignKey: 'invoiceId',
    as: 'membershipInvoice'
});

// ============================================================
// Company (1) ─── (N) SubscriptionPayment
// FK: subscription_payments.company_id → companies.id (CASCADE)
// ============================================================
Company.hasMany(SubscriptionPayment, {
    foreignKey: 'companyId',
    as: 'payments',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
SubscriptionPayment.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Company (1) ─── (N) User
// FK: users.company_id → companies.id (CASCADE)
// ============================================================
Company.hasMany(User, {
    foreignKey: 'companyId',
    as: 'users',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
User.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Company (1) ─── (N) Sequence
// FK: sequences.company_id → companies.id (CASCADE)
// ============================================================
Company.hasMany(Sequence, {
    foreignKey: 'companyId',
    as: 'sequences',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
Sequence.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Company (1) ─── (N) Invoice
// FK: invoices.company_id → companies.id (CASCADE)
// ============================================================
Company.hasMany(Invoice, {
    foreignKey: 'companyId',
    as: 'invoices',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
Invoice.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Sequence (1) ─── (N) Invoice
// FK: invoices.sequence_id → sequences.id (RESTRICT)
// ============================================================
Sequence.hasMany(Invoice, {
    foreignKey: 'sequenceId',
    as: 'invoices',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
});
Invoice.belongsTo(Sequence, {
    foreignKey: 'sequenceId',
    as: 'sequence'
});

// ============================================================
// Invoice (1) ─── (N) InvoiceLine
// FK: invoice_lines.invoice_id → invoices.id (CASCADE)
// ============================================================
Invoice.hasMany(InvoiceLine, {
    foreignKey: 'invoiceId',
    as: 'lines',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
InvoiceLine.belongsTo(Invoice, {
    foreignKey: 'invoiceId',
    as: 'invoice'
});

// ============================================================
// Company (1) ─── (N) AuditLog
// FK: audit_logs.company_id → companies.id (SET NULL)
// ============================================================
Company.hasMany(AuditLog, {
    foreignKey: 'companyId',
    as: 'auditLogs',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});
AuditLog.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// User (1) ─── (N) AuditLog
// FK: audit_logs.user_id → users.id (SET NULL)
// ============================================================
User.hasMany(AuditLog, {
    foreignKey: 'userId',
    as: 'auditLogs',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});
AuditLog.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

// ============================================================
// User (1) ─── (N) PasswordReset
// FK: password_resets.user_id → users.id (CASCADE)
// ============================================================
User.hasMany(PasswordReset, {
    foreignKey: 'userId',
    as: 'passwordResets',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
PasswordReset.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

// ============================================================
// Company (1) ─── (N) CompanyLogo
// FK: company_logos.company_id → companies.id (CASCADE)
// UNIQUE (company_id, purpose): 1 logo invoice + 1 logo dashboard
// ============================================================
Company.hasMany(CompanyLogo, {
    foreignKey: 'companyId',
    as: 'logos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
CompanyLogo.belongsTo(Company, {
    foreignKey: 'companyId',
    as: 'company'
});

// ============================================================
// Company (1) ─── (N) Product
// FK: products.company_id → companies.id (CASCADE)
// Catálogo de productos/servicios para el POS interno (Fase 17).
// ============================================================
Company.hasMany(Product, {
    as: 'products',
    foreignKey: 'companyId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
Product.belongsTo(Company, {
    as: 'company',
    foreignKey: 'companyId'
});

// ============================================================
// Company (1) ─── (N) ApiKey
// FK: api_keys.company_id → companies.id (CASCADE)
// API Keys para integraciones externas (Fase 18).
// ============================================================
Company.hasMany(ApiKey, {
    as: 'apiKeys',
    foreignKey: 'companyId',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
});
ApiKey.belongsTo(Company, {
    as: 'company',
    foreignKey: 'companyId'
});


// ============================================================
// User (1) ─── (N) ApiKey
// FK: api_keys.created_by → users.id (SET NULL)
// Usuario que creó la key (puede quedar NULL si el user se borra).
// ============================================================
User.hasMany(ApiKey, {
    as: 'createdApiKeys',
    foreignKey: 'createdBy',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});
ApiKey.belongsTo(User, {
    as: 'creator',
    foreignKey: 'createdBy'
});


// ============================================================
// Exportar todos los modelos con sus asociaciones registradas
// ============================================================
module.exports = {
    Company,
    Plan,
    Subscription,
    SubscriptionPayment,
    User,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog,
    PasswordReset,
    CompanyLogo,
    Product,
    ApiKey
};