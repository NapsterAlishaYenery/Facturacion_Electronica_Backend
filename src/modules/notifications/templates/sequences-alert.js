// ============================================================
// Template: sequences-alert
//
// Caso de uso: job sequences-health-check
//   → detecta secuencias NCF próximas a vencer o con poco stock
//   → envía 1 correo por empresa, agrupando sus secuencias
//
// API pública:
//   - buildSubject({ companyName, count, reason }) → string
//   - render({ companyName, rnc, ownerName, reason, sequences }) → { html, text }
//
// reason: 'expiring' | 'lowStock' | 'mixed'
//   - expiring: todas están por vencer
//   - lowStock: todas tienen poco stock (pero vigentes)
//   - mixed:    hay de ambas
//
// sequences: array de
//   { id, type, prefix, startNumber, endNumber, currentNumber, expiresAt, reason }
// ============================================================

const { wrapLayout, escapeHtml } = require('../notifications.layout');
const BRAND = require('../../../constants/brand');

// ------------------------------------------------------------
// Formatear fecha larga (es-DO)
// ------------------------------------------------------------
function formatDate(date) {
    if (!date) return null;
    return new Date(date).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ------------------------------------------------------------
// Construir el identificador legible de una secuencia
// Formato: "E31 (0000000001 – 0000000100)"
// ------------------------------------------------------------
function formatSequenceRange(seq) {
    const prefix = seq.prefix || 'E';
    const type = seq.type;
    const start = String(seq.startNumber).padStart(10, '0');
    const end = String(seq.endNumber).padStart(10, '0');
    return `${prefix}${type} (${start} – ${end})`;
}

// ------------------------------------------------------------
// Configuración por motivo
// ------------------------------------------------------------
const REASONS = {
    expiring: {
        color: '#d97706',
        bg: '#fffbeb',
        textColor: '#78350f',
        icon: '⏰',
        headline: 'Secuencias próximas a vencer',
        advice: 'Solicita nuevas secuencias a la DGII antes de la fecha de vencimiento para no interrumpir tu facturación electrónica.'
    },
    lowStock: {
        color: '#d97706',
        bg: '#fffbeb',
        textColor: '#78350f',
        icon: '📉',
        headline: 'Secuencias con poco stock disponible',
        advice: 'Te quedan pocos números en estas secuencias. Solicita nuevas a la DGII antes de agotarlas para no interrumpir tu facturación.'
    },
    mixed: {
        color: '#d97706',
        bg: '#fffbeb',
        textColor: '#78350f',
        icon: '⚠️',
        headline: 'Secuencias que requieren tu atención',
        advice: 'Algunas secuencias están por vencer y otras tienen poco stock. Solicita nuevas secuencias a la DGII para mantener tu facturación activa.'
    }
};

// ------------------------------------------------------------
// Subject dinámico
// ------------------------------------------------------------
function buildSubject({ companyName, count, reason } = {}) {
    const safeCompany = companyName || 'tu empresa';
    const safeCount = Number(count) || 1;
    const plural = safeCount === 1 ? 'secuencia' : 'secuencias';

    if (reason === 'expiring') {
        return `⏰ ${safeCount} ${plural} por vencer en ${safeCompany}`;
    }
    if (reason === 'lowStock') {
        return `📉 ${safeCount} ${plural} con poco stock en ${safeCompany}`;
    }
    return `⚠️ ${safeCount} ${plural} requieren atención en ${safeCompany}`;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------
function render({ companyName, rnc, ownerName, reason, sequences } = {}) {
    // 1. Validaciones mínimas
    if (!companyName) throw new Error('sequencesAlert: companyName is required');
    if (!Array.isArray(sequences) || sequences.length === 0) {
        throw new Error('sequencesAlert: sequences array is required and must not be empty');
    }

    const cfg = REASONS[reason];
    if (!cfg) throw new Error(`sequencesAlert: unknown reason "${reason}"`);

    // 2. Datos escapados
    const safeCompany = escapeHtml(companyName);
    const safeRnc = rnc ? escapeHtml(String(rnc)) : null;
    const safeOwner = escapeHtml(ownerName || 'usuario');

    // 3. Filas de secuencias (tabla)
    const sequenceRows = sequences.map((seq, idx) => {
        const range = formatSequenceRange(seq);
        const isLast = idx === sequences.length - 1;

        // Subtexto según el motivo de esa secuencia específica
        let subtext = '';
        if (seq.reason === 'lowStock') {
            const remaining = Number(seq.endNumber) - Number(seq.currentNumber);
            subtext = `Quedan ${remaining} números disponibles`;
        } else if (seq.reason === 'expiring' && seq.expiresAt) {
            subtext = `Vence el ${formatDate(seq.expiresAt)}`;
        }

        return `
            <tr>
                <td style="padding:12px 0;border-bottom:${isLast ? 'none' : '1px solid #e5e7eb'};vertical-align:top;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:15px;color:${BRAND.primaryColor};font-weight:bold;">
                        ${escapeHtml(range)}
                    </div>
                    ${subtext ? `
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.mutedColor};margin-top:4px;">
                        ${escapeHtml(subtext)}
                    </div>` : ''}
                </td>
            </tr>`;
    }).join('');

    const sequencesBlock = `
        <div style="background:${BRAND.bgColor};border-radius:8px;padding:16px 20px;margin:20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
                ${sequenceRows}
            </table>
        </div>`;

    // 4. Bloque de aviso
    const alertBlock = `
        <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};padding:14px 18px;margin:20px 0;border-radius:4px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${cfg.textColor};font-weight:bold;margin-bottom:6px;">
                ${cfg.icon} ${escapeHtml(cfg.headline)}
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${cfg.textColor};line-height:1.5;">
                ${escapeHtml(cfg.advice)}
            </div>
        </div>`;

    // 5. Datos de empresa
    const companyBlock = `
        <table role="presentation" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0;">
            <tr>
                <td style="color:${BRAND.mutedColor};width:120px;">Empresa:</td>
                <td><strong>${safeCompany}</strong></td>
            </tr>
            ${safeRnc ? `
            <tr>
                <td style="color:${BRAND.mutedColor};">RNC:</td>
                <td><strong>${safeRnc}</strong></td>
            </tr>` : ''}
        </table>`;

    // 6. Body HTML
    const bodyHtml = `
        <p>Hola <strong>${safeOwner}</strong>,</p>
        <p>Detectamos que <strong>${safeCompany}</strong> tiene secuencias NCF que requieren tu atención:</p>
        ${alertBlock}
        ${sequencesBlock}
        ${companyBlock}
        <p style="color:${BRAND.mutedColor};font-size:13px;margin-top:24px;">
            Si ya solicitaste nuevas secuencias a la DGII, regístralas en el sistema para detener estos avisos.
        </p>
        <p style="margin-top:24px;color:${BRAND.mutedColor};font-size:14px;">
            — El equipo de ${escapeHtml(BRAND.name)}
        </p>`;

    // 7. Texto plano
    const seqLines = sequences.map(seq => {
        const range = formatSequenceRange(seq);
        let extra = '';
        if (seq.reason === 'lowStock') {
            const remaining = Number(seq.endNumber) - Number(seq.currentNumber);
            extra = ` (quedan ${remaining})`;
        } else if (seq.reason === 'expiring' && seq.expiresAt) {
            extra = ` (vence ${formatDate(seq.expiresAt)})`;
        }
        return `  • ${range}${extra}`;
    }).join('\n');

    const text =
        `Hola ${ownerName || 'usuario'},\n\n` +
        `Detectamos que ${companyName}` +
        (rnc ? ` (RNC ${rnc})` : '') +
        ` tiene secuencias NCF que requieren tu atención:\n\n` +
        `${cfg.headline}:\n${seqLines}\n\n` +
        `${cfg.advice}\n\n` +
        `Si ya solicitaste nuevas secuencias a la DGII, regístralas en el sistema para detener estos avisos.\n\n` +
        `— El equipo de ${BRAND.name}`;

    // 8. Retorno
    const subject = buildSubject({ companyName, count: sequences.length, reason });
    return {
        html: wrapLayout({ title: subject, bodyHtml }),
        text
    };
}

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------
module.exports = { buildSubject, render };