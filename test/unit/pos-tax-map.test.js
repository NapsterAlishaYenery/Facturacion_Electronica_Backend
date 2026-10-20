// ============================================================
// Test unitario: TAX_MAP y helpers del módulo POS
//
// Verifica que:
//   - TAX_MAP tiene exactamente 4 entradas (ITBIS_18, 16, 3, EXENTO)
//   - Cada entrada mapea al itbisRate + indicadorFacturacion correctos
//   - NO existe ITBIS_3_46 (exclusivo de tipo 46, gestionado aparte)
//   - estimateTotal calcula bien con mezcla de tasas
//
// No requiere BD ni server.
//
// Uso:
//   node test/unit/pos-tax-map.test.js
// ============================================================

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

// Cargar el módulo (necesita los modelos, pero no toca BD
// porque solo leemos TAX_MAP y helpers puros)
const { TAX_MAP, _helpers } = require('../../src/modules/pos/pos.service');
const { estimateTotal } = _helpers;

// ============================================================
console.log('=== TESTS: TAX_MAP ===\n');

// ------------------------------------------------------------
// 1. Estructura
// ------------------------------------------------------------
console.log('--- Estructura ---');
const keys = Object.keys(TAX_MAP);
test('exactamente 4 entradas', keys.length === 4, `got ${keys.length}`);

const expectedKeys = ['ITBIS_18', 'ITBIS_16', 'ITBIS_3', 'EXENTO'];
for (const k of expectedKeys) {
    test(`incluye ${k}`, keys.includes(k));
}

test('NO incluye ITBIS_3_46 (exclusivo tipo 46 fuera del TAX_MAP base)',
    !keys.includes('ITBIS_3_46'));

// ------------------------------------------------------------
// 2. Mappings correctos
// ------------------------------------------------------------
console.log('\n--- Mappings ---');

test('ITBIS_18 → itbisRate 18',
    TAX_MAP.ITBIS_18.itbisRate === 18);
test('ITBIS_18 → indicadorFacturacion 1',
    TAX_MAP.ITBIS_18.indicadorFacturacion === 1);

test('ITBIS_16 → itbisRate 16',
    TAX_MAP.ITBIS_16.itbisRate === 16);
test('ITBIS_16 → indicadorFacturacion 2',
    TAX_MAP.ITBIS_16.indicadorFacturacion === 2);

test('ITBIS_3 → itbisRate 0',
    TAX_MAP.ITBIS_3.itbisRate === 0);
test('ITBIS_3 → indicadorFacturacion 3',
    TAX_MAP.ITBIS_3.indicadorFacturacion === 3);

test('EXENTO → itbisRate 0',
    TAX_MAP.EXENTO.itbisRate === 0);
test('EXENTO → indicadorFacturacion 4',
    TAX_MAP.EXENTO.indicadorFacturacion === 4);

// ------------------------------------------------------------
// 3. Consistencia global
// ------------------------------------------------------------
console.log('\n--- Consistencia ---');

// Ninguna entrada debe tener indicador 0 (No Facturable).
// Ese indicador no se usa en el POS.
const hasIndicador0 = Object.values(TAX_MAP).some(t => t.indicadorFacturacion === 0);
test('ningún tax mapea a indicador 0 (No Facturable)', !hasIndicador0);

// Los indicadores deben ser únicos (no dos tax al mismo indicador).
const indicadores = Object.values(TAX_MAP).map(t => t.indicadorFacturacion);
const uniqueIndicadores = new Set(indicadores);
test('indicadores únicos (1, 2, 3, 4)',
    uniqueIndicadores.size === 4 && indicadores.length === 4,
    `got ${JSON.stringify(indicadores)}`);

// itbisRate > 0 debe corresponder a indicador 1 o 2.
for (const [key, tax] of Object.entries(TAX_MAP)) {
    if (tax.itbisRate > 0) {
        test(`${key}: itbisRate > 0 → indicador 1 o 2`,
            tax.indicadorFacturacion === 1 || tax.indicadorFacturacion === 2);
    }
}

// ============================================================
console.log('\n=== TESTS: estimateTotal ===\n');

// ------------------------------------------------------------
// 4. estimateTotal con líneas mixtas
// ------------------------------------------------------------
console.log('--- estimateTotal ---');

// 1 producto 18% + 1 producto 16% + 1 exento
const items1 = [
    { quantity: 2, unitPrice: 100, itbisRate: 18, discount: 0 },  // 200 + 36 = 236
    { quantity: 1, unitPrice: 100, itbisRate: 16, discount: 0 },  // 100 + 16 = 116
    { quantity: 3, unitPrice: 50,  itbisRate: 0,  discount: 0 }   // 150 + 0 = 150
];
const total1 = estimateTotal(items1);
test('mixto 18%+16%+exento = 502',
    Math.abs(total1 - 502) < 0.01, `got ${total1}`);

// Con descuento
const items2 = [
    { quantity: 2, unitPrice: 100, itbisRate: 18, discount: 20 }  // (200-20)*1.18 = 212.4
];
const total2 = estimateTotal(items2);
test('con descuento = 212.40',
    Math.abs(total2 - 212.40) < 0.01, `got ${total2}`);

// Línea sin discount (undefined)
const items3 = [
    { quantity: 1, unitPrice: 100, itbisRate: 18 }  // 118
];
const total3 = estimateTotal(items3);
test('sin discount explícito = 118',
    Math.abs(total3 - 118) < 0.01, `got ${total3}`);

// Lista vacía
const total4 = estimateTotal([]);
test('lista vacía = 0', total4 === 0);

// Sólo exento
const items5 = [
    { quantity: 10, unitPrice: 25, itbisRate: 0, discount: 0 }
];
const total5 = estimateTotal(items5);
test('solo exento = 250',
    Math.abs(total5 - 250) < 0.01, `got ${total5}`);

// ITBIS_3 (tasa 0 pero indicador 3) — para el cálculo de totales
// se comporta como exento (no suma ITBIS)
const items6 = [
    { quantity: 1, unitPrice: 1000, itbisRate: 0, discount: 0 }
];
const total6 = estimateTotal(items6);
test('ITBIS_3 (rate 0) = 1000',
    Math.abs(total6 - 1000) < 0.01, `got ${total6}`);

// ============================================================
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);