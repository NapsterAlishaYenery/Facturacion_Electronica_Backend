// ============================================================
// Servicio de facturación interna
// Genera facturas de membresía emitidas por el dueño del
// sistema (ExpediNap) hacia los clientes que pagan un plan.
//
// NO es un módulo con endpoints. Es un servicio interno que
// se llama desde subscriptions.service.js (registerPayment)
// cuando un pago queda en status 'paid'.
// ============================================================

const {
    Company,
    Plan,
    Invoice,
    SubscriptionPayment
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');
const invoicesService = require('../invoices/invoices.service');

// ------- helpers -------

// ------------------------------------------------------------
// Cargar la empresa dueña del sistema (ExpediNap).
// Falla explícitamente si no está configurada.
// ------------------------------------------------------------
async function getSystemOwnerCompany() {
    const company = await Company.findOne({
        where: { isSystemOwner: true },
        attributes: ['id', 'rnc', 'name', 'isActive']
    });

    if (!company) {
        throw new AppError(
            'System owner company not configured. Set is_system_owner = true on your company.',
            500,
            'SYSTEM_OWNER_NOT_CONFIGURED'
        );
    }

    if (!company.isActive) {
        throw new AppError(
            'System owner company is inactive. Cannot issue invoices.',
            500,
            'SYSTEM_OWNER_INACTIVE'
        );
    }

    return company;
}

// ------------------------------------------------------------
// Construir la descripción de la línea de membresía
// Ejemplo: "Membresía Plan Básico - 01/11/2026 al 30/11/2026"
// ------------------------------------------------------------
function buildMembershipDescription(planName, periodStart, periodEnd) {
    const fmt = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    };

    const start = fmt(periodStart);
    const end = fmt(periodEnd);

    if (start && end) {
        return `Membresía ${planName} - ${start} al ${end}`;
    }
    return `Membresía ${planName}`;
}

// ------- module functions -------

// ------------------------------------------------------------
// Crear la factura de membresía
// - Emisor: Expedinap (system owner)
// - Receptor: la empresa que pagó el plan
// - Tipo: 31 (Factura de Crédito Fiscal Electrónica)
// - Estado: draft (para que luego se firme y envíe en Fase 9-10)
//
// Devuelve el invoice generado por createMyInvoice.
// ------------------------------------------------------------
async function createMembershipInvoice({
    clientCompanyId,
    planId,
    paymentId,
    amount,
    periodStart,
    periodEnd,
    reqUser,
    reqInfo = {}
}) {
    // 1. Validar parámetros mínimos
    if (!clientCompanyId) {
        throw new AppError('clientCompanyId is required', 400, 'CLIENT_COMPANY_REQUIRED');
    }
    if (!planId) {
        throw new AppError('planId is required', 400, 'PLAN_REQUIRED');
    }
    if (!amount || Number(amount) <= 0) {
        throw new AppError('amount must be greater than 0', 400, 'INVALID_AMOUNT');
    }

    // 1.2. GUARD DE IDEMPOTENCIA
    //    Si el pago ya tiene invoiceId, la factura ya fue generada.
    //    Devolvemos la existente sin consumir otro e-NCF.
    const existingPayment = await SubscriptionPayment.findByPk(paymentId, {
        attributes: ['id', 'invoiceId']
    });

    if (!existingPayment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (existingPayment.invoiceId) {
        const existingInvoice = await Invoice.findByPk(existingPayment.invoiceId);
        return existingInvoice;
    }


    // 2. Cargar Expedinap (emisor)
    const systemOwner = await getSystemOwnerCompany();

    // 3. Cargar la empresa cliente (receptor)
    const client = await Company.findByPk(clientCompanyId, {
        attributes: ['id', 'rnc', 'name', 'email', 'isActive']
    });

    if (!client) {
        throw new AppError('Client company not found', 404, 'CLIENT_COMPANY_NOT_FOUND');
    }
    if (!client.isActive) {
        throw new AppError('Client company is inactive', 403, 'CLIENT_COMPANY_INACTIVE');
    }

    // No puedes facturarte a ti mismo
    if (client.id === systemOwner.id) {
        throw new AppError(
            'Cannot issue a membership invoice to the system owner company',
            400,
            'SELF_INVOICE_NOT_ALLOWED'
        );
    }

    // 4. Cargar el plan
    const plan = await Plan.findByPk(planId, {
        attributes: ['id', 'code', 'name', 'priceDop']
    });

    if (!plan) {
        throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
    }

    // 5. Tasa de ITBIS para membresías (configurable por .env)
    const itbisRate = Number(process.env.MEMBERSHIP_ITBIS_RATE || 0);

    // 6. Descripción de la línea
    const description = buildMembershipDescription(plan.name, periodStart, periodEnd);

    // 7. Payload para createMyInvoice
    //    OJO: el amount ya viene en DOP. Si algún día facturamos en USD,
    //    aquí se convierte antes de pasarlo.
    const invoicePayload = {
        type: '31',
        receiverRnc: client.rnc,
        receiverName: client.name,
        issuedAt: new Date(),
        items: [{
            itemCode: plan.code,
            description,
            quantity: 1,
            unitPrice: Number(amount),
            discount: 0,
            itbisRate
        }]
    };

    // 8. Delegar la creación a invoices.service
    //    createMyInvoice ya se encarga de:
    //    - Validar que Expedinap sea system owner (bypass de suscripción)
    //    - Asignar e-NCF desde la secuencia tipo 31 de Expedinap
    //    - Crear el Invoice + InvoiceLine
    //    - Audit log
    const result = await invoicesService.createMyInvoice(
        systemOwner.id,
        invoicePayload,
        reqUser,
        reqInfo
    );

    const invoice = result.invoice;

    // 9. Vincular el pago con la factura generada
    if (paymentId) {
        try {
            await SubscriptionPayment.update(
                { invoiceId: invoice.id },
                { where: { id: paymentId } }
            );
        } catch (err) {
            // No rompemos el flujo si falla el link, pero lo logueamos
            console.error(
                '[internalBilling.createMembershipInvoice] Failed to link payment to invoice:',
                err.message
            );
        }
    }

    return invoice;
}

module.exports = {
    createMembershipInvoice
};