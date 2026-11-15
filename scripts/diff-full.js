// scripts/diff-full.js
// Comparación exhaustiva: invoices.validation.js (original) vs validation/ (nuevo).
// Compara error.message byte a byte. Si difieren → imprime OLD y NEW.

const oldV = require('../src/modules/invoices/invoices.validation');
const newV = require('../src/modules/invoices/validation');

// ---------- helper ----------
let total = 0, diffs = 0, passed = 0;

function normalize(err) {
    // Joi puede devolver el mismo message con distinto orden en details.
    // Usamos error.message (que es details[0].message con abortEarly=true),
    // así que no hay problema. Pero por si acaso, trim.
    return err ? String(err.message).trim() : 'OK';
}

function compareOne(kind, name, data, opts = { abortEarly: true }) {
    total++;
    const schemaOld = kind === 'create' ? oldV.createInvoiceSchema : oldV.updateInvoiceSchema;
    const schemaNew = kind === 'create' ? newV.createInvoiceSchema : newV.updateInvoiceSchema;

    const rOld = schemaOld.validate(data, opts);
    const rNew = schemaNew.validate(data, opts);

    const mOld = normalize(rOld.error);
    const mNew = normalize(rNew.error);

    if (mOld !== mNew) {
        diffs++;
        console.log(`\n✗ [${kind}] ${name}`);
        console.log(`   OLD: ${mOld}`);
        console.log(`   NEW: ${mNew}`);
    } else {
        passed++;
        console.log(`✓ [${kind}] ${name}`);
    }
}

// ---------- helpers de payload ----------
const ISO = (offsetDays = 0) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString();

function baseItem(extra = {}) {
    return {
        itemName: 'X',
        quantity: 1,
        unitPrice: 100,
        unidadMedida: 1,
        ...extra
    };
}

function base31(extra = {}) {
    return {
        type: '31',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem()],
        ...extra
    };
}

// ============================================================
// CREATE — payloads
// ============================================================
const createCases = [
    // ---------- VÁLIDOS ----------
    ['ok-31-minimo', base31()],

    ['ok-31-completo', base31({
        issuedAt: ISO(0),
        tipoPago: 1,
        tipoMoneda: 'USD',
        tipoCambio: 58.5,
        codigoVendedor: 'V-01',
        numeroFacturaInterna: 'F-001',
        contactoComprador: 'Juan',
        correoComprador: 'j@x.com',
        direccionComprador: 'Calle 1',
        fechaEntrega: ISO(1),
        numeroOrdenCompra: 'OC-1'
    })],

    ['ok-32-small', {
        type: '32',
        items: [baseItem()]
    }],

    ['ok-32-grande-con-rnc', {
        type: '32',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem({ unitPrice: 300000 })]
    }],

    ['ok-33-nota-debito', {
        type: '33',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-5),
        modificationCode: 1,
        modificationReason: 'Ajuste',
        items: [baseItem()]
    }],

    ['ok-34-nota-credito-30d', {
        type: '34',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-10),
        modificationCode: 1,
        indicadorNotaCredito: 0,
        items: [baseItem()]
    }],

    ['ok-34-nota-credito-60d', {
        type: '34',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-60),
        modificationCode: 1,
        indicadorNotaCredito: 1,
        items: [baseItem()]
    }],

    ['ok-41-retencion', {
        type: '41',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem({ retencion: { indicador: 1, montoItbisRetenido: 10 } })]
    }],

    ['ok-43-gastos-menores', {
        type: '43',
        items: [baseItem({ indicadorFacturacion: 4 })]
    }],

    ['ok-44-exento', {
        type: '44',
        receiverName: 'ACME',
        items: [baseItem({ indicadorFacturacion: 4 })]
    }],

    ['ok-45-con-comprador', {
        type: '45',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem()]
    }],

    ['ok-46-exportacion', {
        type: '46',
        receiverName: 'ACME',
        receiverIdentificadorExtranjero: 'EXT-1',
        receiverPais: 'US',
        items: [baseItem({ indicadorFacturacion: 3, itbisRate: 0 })]
    }],

    ['ok-47-retencion-servicio', {
        type: '47',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem({
            indicadorFacturacion: 4,
            indicadorBienoServicio: 2,
            unidadMedida: null,
            retencion: { indicador: 1, montoIsrRetenido: 5 }
        })]
    }],

    ['ok-31-subtotales', base31({
        subtotales: [{ numeroSubtotal: 1, descripcion: 'A' }, { numeroSubtotal: 2 }],
        items: [
            baseItem({ subtotalId: 1 }),
            baseItem({ subtotalId: 2 }),
            baseItem({ subtotalId: 1 })
        ]
    })],

    ['ok-31-dt33-porcentaje', base31({
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    })],

    ['ok-31-dt33-monto-un-indicador', base31({
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '$', monto: 50, indicadorFacturacion: 1 }
        ]
    })],

    ['ok-31-issuedAt-hoy', base31({ issuedAt: ISO(0) })],

    ['ok-31-transporte', base31({
        transporte: { viaTransporte: '01', paisOrigen: 'DO', paisDestino: 'US' }
    })],

    ['ok-31-informaciones', base31({
        informacionesAdicionales: { fechaEmbarque: ISO(0), numeroEmbarque: 'E-1' }
    })],

    ['ok-31-item-completo', base31({
        items: [baseItem({
            itemCode: 'SKU-1',
            additionalCodes: [{ tipoCodigo: 'EAN', codigoItem: '123' }],
            indicadorBienoServicio: 1,
            descuentoOtraMoneda: 1,
            recargoOtraMoneda: 0,
            subcantidades: [{ subcantidad: 1, codigoSubcantidad: 1 }],
            subDescuentos: [{ tipoSubDescuento: '%', subDescuentoPorcentaje: 5, montoSubDescuento: 5 }],
            subRecargos: [{ tipoSubRecargo: '$', montoSubRecargo: 2 }],
            impuestosAdicionales: [{ codigo: '005' }],
            gradosAlcohol: 40,
            cantidadReferencia: 750,
            unidadReferencia: 59,
            fechaElaboracion: ISO(-100),
            fechaVencimientoItem: ISO(100)
        })]
    })],

    // ---------- INVÁLIDOS ----------
    ['bad-31-sin-type', { items: [baseItem()] }],

    ['bad-31-type-invalido', base31({ type: '99' })],

    ['bad-31-issuedAt-futuro', base31({ issuedAt: ISO(10) })],

    ['bad-31-item-itbisRate', base31({
        items: [baseItem({ indicadorFacturacion: 1, itbisRate: 16 })]
    })],

    ['bad-31-item-unidad', base31({ items: [{ itemName: 'X', quantity: 1, unitPrice: 100 }] })],

    ['bad-31-item-discount', base31({
        items: [baseItem({ discount: 200 })]
    })],

    ['bad-31-item-refs', base31({
        items: [baseItem({ cantidadReferencia: 5 })]
    })],

    ['bad-31-item-refs2', base31({
        items: [baseItem({ unidadReferencia: 5 })]
    })],

    ['bad-31-item-fechas', base31({
        items: [baseItem({ fechaElaboracion: ISO(10), fechaVencimientoItem: ISO(-10) })]
    })],

    ['bad-31-item-grados', base31({
        items: [baseItem({ indicadorBienoServicio: 2, unidadMedida: null, gradosAlcohol: 40 })]
    })],

    ['bad-31-sin-rnc', { type: '31', receiverName: 'ACME', items: [baseItem()] }],

    ['bad-31-sin-name', { type: '31', receiverRnc: '123456789', items: [baseItem()] }],

    ['bad-34-sin-indicador', {
        type: '34',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-10),
        modificationCode: 1,
        items: [baseItem()]
    }],

    ['bad-34-indicador-malo', {
        type: '34',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-60),
        modificationCode: 1,
        indicadorNotaCredito: 0,
        items: [baseItem()]
    }],

    ['bad-43-con-rnc', {
        type: '43',
        receiverRnc: '123456789',
        items: [baseItem({ indicadorFacturacion: 4 })]
    }],

    ['bad-43-indicador-no-4', {
        type: '43',
        items: [baseItem({ indicadorFacturacion: 1 })]
    }],

    ['bad-46-sin-pais', {
        type: '46',
        receiverIdentificadorExtranjero: 'X',
        receiverName: 'ACME',
        items: [baseItem({ indicadorFacturacion: 3, itbisRate: 0 })]
    }],

    ['bad-46-sin-ident', {
        type: '46',
        receiverName: 'ACME',
        receiverPais: 'US',
        items: [baseItem({ indicadorFacturacion: 3, itbisRate: 0 })]
    }],

    ['bad-46-indicador-no-3', {
        type: '46',
        receiverIdentificadorExtranjero: 'X',
        receiverName: 'ACME',
        receiverPais: 'US',
        items: [baseItem({ indicadorFacturacion: 4 })]
    }],

    ['bad-47-sin-retencion', {
        type: '47',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem({ indicadorFacturacion: 4, indicadorBienoServicio: 2, unidadMedida: null })]
    }],

    ['bad-47-bien', {
        type: '47',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        items: [baseItem({
            indicadorFacturacion: 4,
            indicadorBienoServicio: 1,
            retencion: { indicador: 1 }
        })]
    }],

    ['bad-32-grande-sin-rnc', {
        type: '32',
        items: [baseItem({ unitPrice: 300000 })]
    }],

    ['bad-32-grande-sin-name', {
        type: '32',
        receiverRnc: '123456789',
        items: [baseItem({ unitPrice: 300000 })]
    }],

    ['bad-tipoMoneda-DOP', base31({ tipoMoneda: 'DOP', tipoCambio: 1 })],

    ['bad-tipoMoneda-sin-cambio', base31({ tipoMoneda: 'USD' })],

    ['bad-tipoPago-2-sin-fecha', base31({ tipoPago: 2 })],

    ['bad-tipoPago-1-con-fecha', base31({ tipoPago: 1, fechaLimitePago: ISO(30) })],

    ['bad-fechas-rango', base31({ fechaDesde: ISO(5), fechaHasta: ISO(-5) })],

    ['bad-dt35-codigo-invalido-tipo', base31({ modificationCode: 1 })],

    ['bad-dt35-codigo5-ncf-papel', base31({
        modifiedNcf: 'A010000000001',
        modifiedNcfDate: ISO(-5),
        modificationCode: 5
    })],

    ['bad-dt35-codigo4-ncf-invalido', base31({
        modifiedNcf: 'XYZ',
        modifiedNcfDate: ISO(-5),
        modificationCode: 4
    })],

    ['bad-33-sin-modifiedNcf', {
        type: '33',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcfDate: ISO(-5),
        modificationCode: 1,
        items: [baseItem()]
    }],

    ['bad-33-sin-modifiedNcfDate', {
        type: '33',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modificationCode: 1,
        items: [baseItem()]
    }],

    ['bad-33-sin-modificationCode', {
        type: '33',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        modifiedNcf: 'E310000000001',
        modifiedNcfDate: ISO(-5),
        items: [baseItem()]
    }],

    ['bad-31-con-modifiedNcf-sin-fecha', base31({
        modifiedNcf: 'E310000000001',
        modificationCode: 4
    })],

    ['bad-31-con-fecha-sin-modifiedNcf', base31({
        modifiedNcfDate: ISO(-5)
    })],

    ['bad-31-con-rnc-otro-sin-modifiedNcf', base31({
        modifiedNcfIssuerRnc: '987654321'
    })],

    ['bad-subtotales-dup', base31({
        subtotales: [{ numeroSubtotal: 1 }, { numeroSubtotal: 1 }],
        items: [baseItem({ subtotalId: 1 })]
    })],

    ['bad-subtotales-huerfano', base31({
        subtotales: [{ numeroSubtotal: 1 }],
        items: [baseItem({ subtotalId: 2 })]
    })],

    ['bad-subtotales-sin-items', base31({
        subtotales: [{ numeroSubtotal: 1 }, { numeroSubtotal: 2 }],
        items: [baseItem({ subtotalId: 1 })]
    })],

    ['bad-subtotalId-sin-subtotales', base31({
        items: [baseItem({ subtotalId: 1 })]
    })],

    ['bad-dt33-dup', base31({
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 },
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    })],

    ['bad-dt33-43', {
        type: '43',
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ],
        items: [baseItem({ indicadorFacturacion: 4 })]
    }],

    ['bad-dt33-47', {
        type: '47',
        receiverRnc: '123456789',
        receiverName: 'ACME',
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ],
        items: [baseItem({
            indicadorFacturacion: 4,
            indicadorBienoServicio: 2,
            unidadMedida: null,
            retencion: { indicador: 1 }
        })]
    }],

    ['bad-dt33-norma1007-recarGO', base31({
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'R', indicadorNorma1007: 1, tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    })],

    ['bad-dt33-monto-con-multi-indicador', base31({
        items: [
            baseItem({ indicadorFacturacion: 1 }),
            baseItem({ indicadorFacturacion: 4, unidadMedida: 1, itbisRate: 0 })
        ],
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '$', monto: 50, indicadorFacturacion: 1 }
        ]
    })],

    ['bad-fechaDesde-sin-hasta-ok', base31({ fechaDesde: ISO(-1) })],

    ['bad-retencion-tipo-32', {
        type: '32',
        items: [baseItem({ retencion: { indicador: 1 } })]
    }],

    ['bad-retencion-tipo-43', {
        type: '43',
        items: [baseItem({ indicadorFacturacion: 4, retencion: { indicador: 1 } })]
    }],
];

// ============================================================
// UPDATE — payloads
// ============================================================
const updateCases = [
    // ---------- VÁLIDOS ----------
    ['ok-update-price-only', { receiverRnc: '123456789' }],
    ['ok-update-name-only', { receiverName: 'ACME' }],
    ['ok-update-issuedAt-hoy', { issuedAt: ISO(0) }],
    ['ok-update-issuedAt-29d', { issuedAt: ISO(-29) }],
    ['ok-update-items', { items: [baseItem()] }],
    ['ok-update-item-completo', {
        items: [baseItem({
            itemCode: 'SKU-1',
            indicadorBienoServicio: 1,
            gradosAlcohol: 40,
            cantidadReferencia: 750,
            unidadReferencia: 59,
            fechaElaboracion: ISO(-100),
            fechaVencimientoItem: ISO(100),
            retencion: { indicador: 1, montoItbisRetenido: 5 }
        })]
    }],
    ['ok-update-subtotales', {
        subtotales: [{ numeroSubtotal: 1 }, { numeroSubtotal: 2 }],
        items: [baseItem({ subtotalId: 1 }), baseItem({ subtotalId: 2 })]
    }],
    ['ok-update-subtotales-sin-items', {
        subtotales: [{ numeroSubtotal: 1 }]
    }],
    ['ok-update-dt33', {
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    }],
    ['ok-update-tipoMoneda-USD', { tipoMoneda: 'USD', tipoCambio: 58 }],
    ['ok-update-tipoMoneda-sin-cambio', { tipoMoneda: 'USD' }], // update no exige tipoCambio
    ['ok-update-fechas', { fechaDesde: ISO(-5), fechaHasta: ISO(5) }],
    ['ok-update-modificationCode', { modificationCode: 3 }],
    ['ok-update-modificationReason', { modificationReason: 'Ajuste' }],

    // ---------- INVÁLIDOS ----------
    ['bad-update-vacio', {}],

    ['bad-update-issuedAt-futuro', { issuedAt: ISO(10) }],

    ['bad-update-issuedAt-31d', { issuedAt: ISO(-31) }],

    ['bad-update-item-itbisRate', {
        items: [baseItem({ indicadorFacturacion: 1, itbisRate: 16 })]
    }],

    ['bad-update-item-unidad', {
        items: [{ itemName: 'X', quantity: 1, unitPrice: 100 }]
    }],

    ['bad-update-item-discount', {
        items: [baseItem({ discount: 200 })]
    }],

    ['bad-update-item-retencion', {
        items: [baseItem({ retencion: { indicador: 5 } })]
    }],

    ['bad-update-item-refs', {
        items: [baseItem({ cantidadReferencia: 5 })]
    }],

    ['bad-update-item-fechas', {
        items: [baseItem({ fechaElaboracion: ISO(10), fechaVencimientoItem: ISO(-10) })]
    }],

    ['bad-update-item-grados', {
        items: [baseItem({ indicadorBienoServicio: 2, unidadMedida: null, gradosAlcohol: 40 })]
    }],

    ['bad-update-modificationCode-0', { modificationCode: 0 }],

    ['bad-update-modificationCode-6', { modificationCode: 6 }],

    ['bad-update-fechas', { fechaDesde: ISO(5), fechaHasta: ISO(-5) }],

    ['bad-update-tipoMoneda-DOP', { tipoMoneda: 'DOP' }],

    ['bad-update-subtotales-dup', {
        subtotales: [{ numeroSubtotal: 1 }, { numeroSubtotal: 1 }]
    }],

    ['bad-update-subtotales-huerfano', {
        subtotales: [{ numeroSubtotal: 1 }],
        items: [baseItem({ subtotalId: 2 })]
    }],

    ['bad-update-dt33-dup', {
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 },
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    }],

    ['bad-update-dt33-norma1007', {
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'R', indicadorNorma1007: 1, tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
        ]
    }],

    ['bad-update-dt33-monto-multi', {
        items: [
            baseItem({ indicadorFacturacion: 1 }),
            baseItem({ indicadorFacturacion: 4, unidadMedida: 1, itbisRate: 0 })
        ],
        descuentosORecargos: [
            { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '$', monto: 50, indicadorFacturacion: 1 }
        ]
    }],

    ['bad-update-type-prohibido', { type: '31' }],

    ['bad-update-modifiedNcf-prohibido', { modifiedNcf: 'E310000000001' }],

    ['bad-update-transporte-prohibido', { transporte: { viaTransporte: '01' } }],

    ['bad-update-exemptAmount-prohibido', { exemptAmount: 100 }],

    ['bad-update-totalItbisRetenido-prohibido', { totalItbisRetenido: 100 }],
];

// ============================================================
// RUN
// ============================================================
console.log('=== CREATE ===\n');
for (const [name, data] of createCases) compareOne('create', name, data);

console.log('\n=== UPDATE ===\n');
for (const [name, data] of updateCases) compareOne('update', name, data);

console.log(`\n=== RESULTADO: ${passed}/${total} iguales, ${diffs} diferencias ===\n`);
process.exit(diffs > 0 ? 1 : 0);