// tmp-check.js
const { InvoiceLine } = require('../src/models');

console.log('indicador 1 →', InvoiceLine.getRateFromIndicador(1)); // esperado 18
console.log('indicador 2 →', InvoiceLine.getRateFromIndicador(2)); // esperado 16
console.log('indicador 3 →', InvoiceLine.getRateFromIndicador(3)); // esperado 0
console.log('indicador 4 →', InvoiceLine.getRateFromIndicador(4)); // esperado 0
console.log('indicador 0 →', InvoiceLine.getRateFromIndicador(0)); // esperado 0

console.log('rate 18 →', InvoiceLine.getIndicadorFromRate(18));    // esperado 1
console.log('rate 16 →', InvoiceLine.getIndicadorFromRate(16));    // esperado 2
console.log('rate 0  →', InvoiceLine.getIndicadorFromRate(0));     // esperado 4
console.log('rate 99 →', InvoiceLine.getIndicadorFromRate(99));    // esperado 4