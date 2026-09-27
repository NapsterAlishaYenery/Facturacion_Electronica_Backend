const {
    buildQRCodeData,
    extractSecurityCode
} = require('../../src/modules/invoices/ecf/xml-generator');

let passed = 0;
let failed = 0;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

console.log('=== TESTS: extractSecurityCode ===\n');

test('extract first 6 chars', extractSecurityCode('ARB+Ux123456') === 'ARB+Ux');
test('extract with slash', extractSecurityCode('Ab/CdEfGh') === 'Ab/CdE');
test('null returns empty', extractSecurityCode(null) === '');
test('undefined returns empty', extractSecurityCode(undefined) === '');
test('short string returns all', extractSecurityCode('AbC') === 'AbC');

console.log('\n=== TESTS: buildQRCodeData (FC < 250K) ===\n');

const fcInvoice = {
    issuerRnc: '130999111',
    ncf: 'E320000000001',
    receiverRnc: '130999888',
    total: 1180.00,
    issuedAt: new Date('2026-09-27T14:30:00'),
    type: '32',
    signedAt: new Date('2026-09-27T14:30:00'),
    securityCode: 'ARB+Ux'
};

const fcUrl = buildQRCodeData(fcInvoice);
console.log('   URL:', fcUrl);

test('uses fc.dgii.gov.do', fcUrl.startsWith('https://fc.dgii.gov.do/ecf/ConsultaTimbreFC?'));
test('has RncEmisor', fcUrl.includes('RncEmisor=130999111'));
test('has ENCF', fcUrl.includes('ENCF=E320000000001'));
test('has MontoTotal', fcUrl.includes('MontoTotal=1180.00'));
test('has CodigoSeguridad', fcUrl.includes('CodigoSeguridad=ARB%2BUx'));
test('does NOT have RncComprador', !fcUrl.includes('RncComprador'));
test('does NOT have FechaEmision', !fcUrl.includes('FechaEmision'));

console.log('\n=== TESTS: buildQRCodeData (e-CF normal) ===\n');

const normalInvoice = {
    issuerRnc: '130999111',
    ncf: 'E310000000001',
    receiverRnc: '130999888',
    total: 5000.00,
    issuedAt: new Date('2026-09-27T14:30:00'),
    type: '31',
    signedAt: new Date('2026-09-27T14:30:00'),
    securityCode: 'Ab+CdE'
};

const normalUrl = buildQRCodeData(normalInvoice);
console.log('   URL:', normalUrl);

test('uses ecf.dgii.gov.do', normalUrl.startsWith('https://ecf.dgii.gov.do/ecf/ConsultaTimbre?'));
test('has RncEmisor', normalUrl.includes('RncEmisor=130999111'));
test('has RncComprador', normalUrl.includes('RncComprador=130999888'));
test('has ENCF', normalUrl.includes('ENCF=E310000000001'));
test('has FechaEmision', normalUrl.includes('FechaEmision=27-09-2026'));
test('has MontoTotal', normalUrl.includes('MontoTotal=5000.00'));
test('has FechaFirma', normalUrl.includes('FechaFirma=27-09-2026'));
test('has CodigoSeguridad encoded', normalUrl.includes('CodigoSeguridad=Ab%2BCdE'));

console.log('\n=== TESTS: buildQRCodeData (FC >= 250K) ===\n');

const fcBigInvoice = {
    ...fcInvoice,
    total: 300000.00,
    ncf: 'E320000000002'
};

const fcBigUrl = buildQRCodeData(fcBigInvoice);
test('uses ecf.dgii.gov.do (not fc)', fcBigUrl.startsWith('https://ecf.dgii.gov.do/ecf/ConsultaTimbre?'));
test('has RncComprador', fcBigUrl.includes('RncComprador=130999888'));

console.log('\n=== TESTS: caracteres especiales ===\n');

const specialInvoice = {
    ...normalInvoice,
    securityCode: 'A+/B=C'
};
const specialUrl = buildQRCodeData(specialInvoice);
test('encodes + as %2B', specialUrl.includes('CodigoSeguridad=A%2B%2FB%3DC'));

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

process.exit(failed > 0 ? 1 : 0);