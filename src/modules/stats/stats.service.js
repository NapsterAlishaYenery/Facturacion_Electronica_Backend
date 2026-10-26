// ============================================================
// Servicio de estadísticas
// Cada método corresponde a un endpoint del dashboard.
// Se calculan con queries directas sobre los modelos existentes.
// ============================================================

const { Op, fn, col, literal } = require('sequelize');
const {
    Invoice,
    InvoiceLine,
    Product,
    Sequence,
    Subscription,
    Plan,
    Company
} = require('../../models');
const { AppError } = require('../../shared/middlewares/error.middleware');

// ------------------------------------------------------------
// Helpers de fechas
// ------------------------------------------------------------
function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function startOfMonth(date = new Date()) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysAgo(n, from = new Date()) {
    const d = new Date(from);
    d.setDate(d.getDate() - n);
    return d;
}

// ------------------------------------------------------------
// GET /api/stats/company
// Dashboard del company_admin
// ------------------------------------------------------------
async function getCompanyStats(companyId, { period = 7 } = {}) {
    if (!companyId) {
        throw new AppError(
            'You do not belong to any company',
            400,
            'NO_COMPANY_ASSIGNED'
        );
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const periodStart = startOfDay(daysAgo(period - 1, now)); // incluye hoy

    // --------------------------------------------------------
    // 1. KPIs del mes (en paralelo)
    // --------------------------------------------------------
    const [
        invoicesThisMonth,
        billedThisMonth,
        itbisThisMonth,
        activeProducts
    ] = await Promise.all([
        Invoice.count({
            where: {
                companyId,
                issuedAt: { [Op.gte]: monthStart }
            }
        }),
        Invoice.sum('total', {
            where: {
                companyId,
                issuedAt: { [Op.gte]: monthStart }
            }
        }),
        Invoice.sum('itbis', {
            where: {
                companyId,
                issuedAt: { [Op.gte]: monthStart }
            }
        }),
        Product.count({
            where: { companyId, isActive: true }
        })
    ]);

    // --------------------------------------------------------
    // 2. Serie de ventas de los últimos N días
    //    Agrupamos por día (DATE(issued_at)) y sumamos total.
    // --------------------------------------------------------
    const salesByDay = await Invoice.findAll({
        attributes: [
            [fn('DATE', col('issued_at')), 'day'],
            [fn('SUM', col('total')), 'total'],
            [fn('COUNT', col('id')), 'count']
        ],
        where: {
            companyId,
            issuedAt: { [Op.gte]: periodStart }
        },
        group: [literal('DATE(issued_at)')],
        order: [[literal('DATE(issued_at)'), 'ASC']],
        raw: true
    });

    // Rellenar días sin ventas con 0 (para que la gráfica no tenga huecos)
    const salesSeries = [];
    for (let i = 0; i < period; i++) {
        const day = startOfDay(daysAgo(period - 1 - i, now));
        const dayStr = day.toISOString().slice(0, 10); // YYYY-MM-DD
        const found = salesByDay.find(r => {
            // sequelize devuelve DATE como string 'YYYY-MM-DD'
            const rDay = typeof r.day === 'string' ? r.day : new Date(r.day).toISOString().slice(0, 10);
            return rDay === dayStr;
        });
        salesSeries.push({
            date: dayStr,
            total: found ? Number(found.total) : 0,
            count: found ? Number(found.count) : 0
        });
    }

    // --------------------------------------------------------
    // 3. Top 5 productos por monto vendido (del mes)
    //    Usamos literal() con el nombre real de columna (item_name)
    //    porque Sequelize NO traduce bien col() en attributes+group+include.
    // --------------------------------------------------------
    const topProducts = await InvoiceLine.findAll({
        attributes: [
            [literal('"InvoiceLine"."item_name"'), 'itemName'],
            [fn('SUM', literal('"InvoiceLine"."total"')), 'totalSold'],
            [fn('SUM', literal('"InvoiceLine"."quantity"')), 'quantitySold']
        ],
        include: [{
            model: Invoice,
            as: 'invoice',
            attributes: [],
            where: {
                companyId,
                issuedAt: { [Op.gte]: monthStart }
            },
            required: true
        }],
        group: [literal('"InvoiceLine"."item_name"')],
        order: [[literal('"totalSold"'), 'DESC']],
        limit: 5,
        raw: true
    });

    // --------------------------------------------------------
    // 4. Últimas 5 facturas
    // --------------------------------------------------------
    const recentInvoices = await Invoice.findAll({
        where: { companyId },
        attributes: ['id', 'ncf', 'type', 'status', 'total', 'issuedAt', 'receiverName'],
        order: [['issuedAt', 'DESC']],
        limit: 5
    });

    // --------------------------------------------------------
    // 5. Alertas
    // --------------------------------------------------------
    const alerts = [];

    // 5a. Secuencia más usada (la que esté al mayor %)
    const sequences = await Sequence.findAll({
        where: { companyId, isActive: true },
        attributes: ['id', 'type', 'prefix', 'startNumber', 'endNumber', 'currentNumber']
    });

    for (const seq of sequences) {
        const total = Number(seq.endNumber) - Number(seq.startNumber) + 1;
        const used = Number(seq.currentNumber) - Number(seq.startNumber) + 1;
        if (total <= 0) continue;
        const pct = Math.round((used / total) * 100);
        if (pct >= 85) {
            alerts.push({
                type: 'sequence_almost_full',
                severity: pct >= 95 ? 'critical' : 'warning',
                message: `Tu secuencia tipo ${seq.type} está al ${pct}% (${used}/${total} números usados)`,
                meta: { sequenceId: seq.id, type: seq.type, used, total, pct }
            });
        }
    }

    // 5b. Certificado por vencer (≤ 30 días)
    const company = await Company.findByPk(companyId, {
        attributes: ['certificateExpiresAt']
    });
    if (company?.certificateExpiresAt) {
        const exp = new Date(company.certificateExpiresAt);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / msPerDay);
        if (daysLeft <= 30) {
            alerts.push({
                type: 'certificate_expiring',
                severity: daysLeft <= 7 ? 'critical' : 'warning',
                message: daysLeft < 0
                    ? 'Tu certificado digital está vencido'
                    : `Tu certificado vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`,
                meta: { expiresAt: company.certificateExpiresAt, daysLeft }
            });
        }
    }

    // 5c. Suscripción por vencer (≤ 7 días)
    const subscription = await Subscription.findOne({
        where: {
            companyId,
            status: { [Op.in]: ['trial', 'active', 'past_due'] }
        },
        include: [{ model: Plan, as: 'plan', attributes: ['id', 'code', 'name', 'invoicesPerMonth'] }],
        order: [['createdAt', 'DESC']]
    });

    if (subscription) {
        const ends = subscription.endsAt || subscription.trialEndsAt;
        if (ends) {
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysLeft = Math.ceil((new Date(ends).getTime() - now.getTime()) / msPerDay);
            if (daysLeft <= 7) {
                alerts.push({
                    type: 'subscription_expiring',
                    severity: daysLeft <= 2 ? 'critical' : 'warning',
                    message: daysLeft < 0
                        ? 'Tu suscripción está vencida'
                        : `Tu suscripción vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`,
                    meta: { endsAt: ends, daysLeft, planCode: subscription.plan?.code }
                });
            }
        }
    }

    // --------------------------------------------------------
    // 6. Respuesta final
    // --------------------------------------------------------
    return {
        kpis: {
            invoicesThisMonth,
            invoiceLimit: subscription?.plan?.invoicesPerMonth ?? null,
            billedThisMonth: Number(billedThisMonth) || 0,
            itbisThisMonth: Number(itbisThisMonth) || 0,
            activeProducts
        },
        salesSeries,
        topProducts: topProducts.map(p => ({
            itemName: p.itemName,
            totalSold: Number(p.totalSold) || 0,
            quantitySold: Number(p.quantitySold) || 0
        })),
        recentInvoices: recentInvoices.map(inv => ({
            id: inv.id,
            ncf: inv.ncf,
            type: inv.type,
            status: inv.status,
            total: Number(inv.total),
            issuedAt: inv.issuedAt,
            receiverName: inv.receiverName
        })),
        alerts
    };
}

module.exports = {
    getCompanyStats
    // getOperatorStats,  ← luego
    // getAdminStats      ← luego
};
