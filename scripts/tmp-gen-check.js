// tmp-gen-check.js
const { generateECF31, validateAgainstXSD } = require('../src/modules/invoices/ecf/xml-generator');

const invoiceData = {
    type: '31',
    ncf: 'E310000000001',
    sequenceExpiresAt: '2027-12-31',
    issuedAt: '2026-10-16',
    issuerRnc: '02800918407',
    issuerName: 'ExpediNap',
    issuerTradeName: 'ExpediNap',
    issuerAddress: 'Higuey, RD',
    issuerPhone: '18098366303',
    issuerEmail: 'test@test.com',
    issuerEconomicActivity: 'Servicios',
    receiverRnc: '13006904627',
    receiverName: 'Distribuidora del Este SRL',
    montoGravado: 315000,
    itbis1Base: 270000,
    itbis1Amount: 48600,
    itbis2Base: 45000,
    itbis2Amount: 7200,
    itbis3Base: 0,
    itbis3Amount: 0,
    exemptAmount: 25000,
    total: 395800,
    lines: [
        { lineNumber: 1, description: 'Servidor', quantity: 1, unitPrice: 285000, discount: 15000, itbisRate: 18, itbisAmount: 48600, indicadorFacturacion: 1, total: 318600 },
        { lineNumber: 2, description: 'Licencia', quantity: 1, unitPrice: 45000, discount: 0, itbisRate: 16, itbisAmount: 7200, indicadorFacturacion: 2, total: 52200 },
        { lineNumber: 3, description: 'Instalacion exenta', quantity: 1, unitPrice: 25000, discount: 0, itbisRate: 0, itbisAmount: 0, indicadorFacturacion: 4, total: 25000 }
    ]
};

const xml = generateECF31(invoiceData);
console.log(xml);
console.log('\n--- Validacion XSD ---');
console.log(JSON.stringify(validateAgainstXSD(xml, '31'), null, 2));