// scripts/diff-fuzz.js
const oldV = require('../src/modules/invoices/invoices.validation.old');
const newV = require('../src/modules/invoices/validation');

const TIPOS = ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'];
const INDICADORES = [undefined, 0, 1, 2, 3, 4];
const ITBIS_RATES = [undefined, 0, 16, 18];
const BIENO_SERV = [undefined, 1, 2];
const UNIDADES = [undefined, null, 1, 5, 43, 59, 99];
const FECHAS = [
    undefined,
    new Date(Date.now() + 86400000 * 10).toISOString(),
    new Date(Date.now() - 86400000 * 10).toISOString(),
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randItem() {
    const it = {
        itemName: 'X',
        quantity: 1,
        unitPrice: 100,
    };
    const ind = rand(INDICADORES);
    if (ind !== undefined) it.indicadorFacturacion = ind;
    const rate = rand(ITBIS_RATES);
    if (rate !== undefined) it.itbisRate = rate;
    const bs = rand(BIENO_SERV);
    if (bs !== undefined) it.indicadorBienoServicio = bs;
    const um = rand(UNIDADES);
    if (um !== undefined) it.unidadMedida = um;
    return it;
}

function randCreate() {
    const type = rand(TIPOS);
    const p = {
        type,
        items: [randItem()],
    };
    if (Math.random() < 0.7) p.receiverRnc = '123456789';
    if (Math.random() < 0.7) p.receiverName = 'ACME';
    if (Math.random() < 0.3) p.issuedAt = rand(FECHAS);
    if (Math.random() < 0.3) p.tipoMoneda = rand(['USD', 'EUR', 'DOP']);
    if (Math.random() < 0.3) p.tipoCambio = rand([1, 58]);
    if (Math.random() < 0.3) p.tipoPago = rand([1, 2, 3]);
    if (Math.random() < 0.3) p.fechaLimitePago = rand(FECHAS);
    if (Math.random() < 0.3 && type === '46') p.receiverPais = rand(['US', 'ES', null]);
    if (Math.random() < 0.3 && (type === '46' || type === '47'))
        p.receiverIdentificadorExtranjero = 'X';
    if (Math.random() < 0.3) p.modificationCode = rand([undefined, 1, 2, 3, 4, 5, 9]);
    if (Math.random() < 0.3) p.modifiedNcf = rand([undefined, 'E310000000001', 'A010000000001', 'XYZ']);
    if (Math.random() < 0.3) p.modifiedNcfDate = rand(FECHAS);
    if (type === '34') p.indicadorNotaCredito = rand([0, 1, 2]);
    if (Math.random() < 0.2) {
        p.subtotales = [{ numeroSubtotal: 1 }, { numeroSubtotal: rand([1, 2]) }];
        p.items[0].subtotalId = rand([1, 2, 3]);
    }
    if (Math.random() < 0.2) {
        p.descuentosORecargos = [{
            numeroLinea: 1,
            tipoAjuste: rand(['D', 'R']),
            tipoValor: rand(['%', '$']),
            valor: 10,
            monto: 50,
            indicadorFacturacion: rand([1, 2, 3, 4])
        }];
    }
    // retención
    if (Math.random() < 0.3) p.items[0].retencion = { indicador: rand([1, 2, 5]) };
    return p;
}

function randUpdate() {
    const p = {};
    if (Math.random() < 0.5) p.receiverRnc = '123456789';
    if (Math.random() < 0.5) p.receiverName = 'ACME';
    if (Math.random() < 0.3) p.issuedAt = rand(FECHAS);
    if (Math.random() < 0.5) p.items = [randItem()];
    if (Math.random() < 0.3) p.tipoMoneda = rand(['USD', 'DOP']);
    if (Math.random() < 0.3) p.tipoCambio = 58;
    if (Math.random() < 0.3) p.tipoPago = rand([1, 2, 3]);
    if (Math.random() < 0.3) p.modificationCode = rand([1, 2, 3, 4, 5, 9]);
    if (Math.random() < 0.2) p.subtotales = [{ numeroSubtotal: 1 }];
    if (Math.random() < 0.2) {
        p.descuentosORecargos = [{
            numeroLinea: 1,
            tipoAjuste: rand(['D', 'R']),
            tipoValor: rand(['%', '$']),
            valor: 10,
            monto: 50,
            indicadorFacturacion: 1
        }];
    }
    return p;
}

function compare(kind, data) {
    const schemaOld = kind === 'create' ? oldV.createInvoiceSchema : oldV.updateInvoiceSchema;
    const schemaNew = kind === 'create' ? newV.createInvoiceSchema : newV.updateInvoiceSchema;
    const mOld = schemaOld.validate(data, { abortEarly: true }).error?.message || 'OK';
    const mNew = schemaNew.validate(data, { abortEarly: true }).error?.message || 'OK';
    return { mOld, mNew, ok: mOld === mNew };
}

const N = 500;
let diffs = 0;
for (let i = 0; i < N; i++) {
    for (const kind of ['create', 'update']) {
        const data = kind === 'create' ? randCreate() : randUpdate();
        const r = compare(kind, data);
        if (!r.ok) {
            diffs++;
            console.log(`\n✗ [${kind}] iteración ${i}`);
            console.log('   DATA:', JSON.stringify(data));
            console.log('   OLD:', r.mOld);
            console.log('   NEW:', r.mNew);
            if (diffs > 10) {
                console.log('\nDemasiadas diferencias, cortando...');
                process.exit(1);
            }
        }
    }
}
console.log(`\n=== FUZZ: ${N * 2} casos, ${diffs} diferencias ===\n`);
process.exit(diffs > 0 ? 1 : 0);