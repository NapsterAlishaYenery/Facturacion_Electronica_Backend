// scripts/diff-create.js
const oldV = require('../src/modules/invoices/invoices.validation');
const newV = require('../src/modules/invoices/validation');

const payloads = [
  // --- VÁLIDOS ---
  { name: 'ok-31-simple', data: {
      type: '31',
      receiverRnc: '123456789',
      receiverName: 'ACME',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'ok-32-small', data: {
      type: '32',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'ok-34-nota', data: {
      type: '34',
      modifiedNcf: 'E310000000001',
      modifiedNcfDate: new Date().toISOString(),
      modificationCode: 1,
      indicadorNotaCredito: 0,
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},

  // --- INVÁLIDOS ---
  { name: 'bad-issuedAt-futuro', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      issuedAt: '2099-01-01',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'bad-item-itbisRate', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1, indicadorFacturacion: 1, itbisRate: 16 }]
  }},
  { name: 'bad-item-unidad', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100 }]
  }},
  { name: 'bad-type31-sin-rnc', data: {
      type: '31', receiverName: 'ACME',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'bad-33-sin-mod', data: {
      type: '33',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'bad-43-con-comprador', data: {
      type: '43', receiverRnc: '123456789',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1, indicadorFacturacion: 4 }]
  }},
  { name: 'bad-46-sin-pais', data: {
      type: '46', receiverIdentificadorExtranjero: 'X',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1, indicadorFacturacion: 3 }]
  }},
  { name: 'bad-32-grande-sin-rnc', data: {
      type: '32',
      items: [{ itemName: 'X', quantity: 1, unitPrice: 300000, unidadMedida: 1 }]
  }},
  { name: 'bad-tipoMoneda-DOP', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      tipoMoneda: 'DOP', tipoCambio: 1,
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'bad-tipoPago-credito-sin-fecha', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      tipoPago: 2,
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
  { name: 'bad-subtotales-duplicado', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      subtotales: [{ numeroSubtotal: 1 }, { numeroSubtotal: 1 }],
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1, subtotalId: 1 }]
  }},
  { name: 'bad-dt33-numeroLinea-dup', data: {
      type: '31', receiverRnc: '123456789', receiverName: 'ACME',
      descuentosORecargos: [
          { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 },
          { numeroLinea: 1, tipoAjuste: 'D', tipoValor: '%', valor: 10, indicadorFacturacion: 1 }
      ],
      items: [{ itemName: 'X', quantity: 1, unitPrice: 100, unidadMedida: 1 }]
  }},
];

let diffs = 0;
for (const { name, data } of payloads) {
  const oldR = oldV.createInvoiceSchema.validate(data, { abortEarly: true });
  const newR = newV.createInvoiceSchema.validate(data, { abortEarly: true });

  const oldMsg = oldR.error ? oldR.error.message : 'OK';
  const newMsg = newR.error ? newR.error.message : 'OK';

  if (oldMsg !== newMsg) {
    diffs++;
    console.log(`✗ ${name}`);
    console.log(`   OLD: ${oldMsg}`);
    console.log(`   NEW: ${newMsg}`);
  } else {
    console.log(`✓ ${name}`);
  }
}
console.log(`\n${diffs === 0 ? '✓ TODO IGUAL' : '✗ ' + diffs + ' DIFERENCIAS'}`);