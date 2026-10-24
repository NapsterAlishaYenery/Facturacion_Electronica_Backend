// ============================================================
// Test unitario: reglas cruzadas de campos DGII (Step 4)
// ============================================================

const { createInvoiceSchema } = require('../../src/modules/invoices/invoices.validation');

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

function buildPayload(items) {
    return {
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Empresa Compradora SRL',
        items
    };
}

function validate(payload) {
    return createInvoiceSchema.validate(payload, { abortEarly: false });
}

console.log('=== TESTS: reglas cruzadas Step 4 ===\n');

// ------------------------------------------------------------
// 1. Bien (indicadorBienoServicio: 1) SIN unidadMedida → error
// ------------------------------------------------------------
console.log('--- Caso 1: Bien sin unidadMedida ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Laptop',
        indicadorBienoServicio: 1,
        quantity: 1,
        unitPrice: 1000,
        itbisRate: 18,
        indicadorFacturacion: 1
        // ← sin unidadMedida
    }]));
    test('error por Bien sin unidadMedida', !!error);
    test('mensaje menciona unidadMedida',
        error?.message?.includes('unidadMedida is required'));
}

// ------------------------------------------------------------
// 2. Bien CON unidadMedida: 43 → OK
// ------------------------------------------------------------
console.log('\n--- Caso 2: Bien con unidadMedida ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Laptop',
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 1000,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('Bien con unidadMedida es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 3. Servicio SIN unidadMedida → OK
// ------------------------------------------------------------
console.log('\n--- Caso 3: Servicio sin unidadMedida ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Consultoría',
        indicadorBienoServicio: 2,
        quantity: 10,
        unitPrice: 1500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('Servicio sin unidadMedida es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 4. cantidadReferencia SIN unidadReferencia → error
// ------------------------------------------------------------
console.log('\n--- Caso 4: cantidadReferencia sin unidadReferencia ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Whisky',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750,
        // ← sin unidadReferencia
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('error por cantidadReferencia sin unidadReferencia', !!error);
    test('mensaje menciona unidadReferencia',
        error?.message?.includes('unidadReferencia is required'));
}

// ------------------------------------------------------------
// 5. unidadReferencia SIN cantidadReferencia → error
// ------------------------------------------------------------
console.log('\n--- Caso 5: unidadReferencia sin cantidadReferencia ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Whisky',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        unidadReferencia: 59,
        // ← sin cantidadReferencia
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('error por unidadReferencia sin cantidadReferencia', !!error);
    test('mensaje menciona cantidadReferencia',
        error?.message?.includes('cantidadReferencia is required'));
}

// ------------------------------------------------------------
// 6. Ambas referencias juntas → OK
// ------------------------------------------------------------
console.log('\n--- Caso 6: ambas referencias juntas ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Whisky',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('ambas referencias son válidas', !error, error?.message);
}

// ------------------------------------------------------------
// 7. fechaVencimientoItem < fechaElaboracion → error
// ------------------------------------------------------------
console.log('\n--- Caso 7: fechaVencimiento < fechaElaboracion ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Medicina',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        fechaElaboracion: '2030-01-15',
        fechaVencimientoItem: '2025-01-15',  // ← antes que elaboración
        quantity: 1,
        unitPrice: 500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('error por fechaVencimiento < fechaElaboracion', !!error);
    test('mensaje menciona fechaVencimientoItem',
        error?.message?.includes('fechaVencimientoItem'));
}

// ------------------------------------------------------------
// 8. fechaVencimientoItem >= fechaElaboracion → OK
// ------------------------------------------------------------
console.log('\n--- Caso 8: fechaVencimiento >= fechaElaboracion ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Medicina',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        fechaElaboracion: '2025-01-15',
        fechaVencimientoItem: '2030-01-15',
        quantity: 1,
        unitPrice: 500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('fechaVencimiento >= fechaElaboracion es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 9. gradosAlcohol en servicio → error
// ------------------------------------------------------------
console.log('\n--- Caso 9: gradosAlcohol en servicio ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Servicio de bar',
        indicadorBienoServicio: 2,
        gradosAlcohol: 40,       // ← no aplica a servicios
        quantity: 1,
        unitPrice: 100,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('error por gradosAlcohol en servicio', !!error);
    test('mensaje menciona gradosAlcohol',
        error?.message?.includes('gradosAlcohol only applies to bienes'));
}

// ------------------------------------------------------------
// 10. gradosAlcohol en bien → OK
// ------------------------------------------------------------
console.log('\n--- Caso 10: gradosAlcohol en bien ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Whisky Old Parr',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        gradosAlcohol: 40,
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('gradosAlcohol en bien es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 11. Item completo (licor) con TODAS las reglas OK
// ------------------------------------------------------------
console.log('\n--- Caso 11: item completo válido ---');
{
    const { error } = validate(buildPayload([{
        itemCode: 'LIC-001',
        itemName: 'Whisky Old Parr 750ml',
        description: 'Botella 750ml, edición especial',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        gradosAlcohol: 40,
        precioUnitarioReferencia: 2700,
        fechaElaboracion: '2025-01-15',
        fechaVencimientoItem: '2030-01-15',
        quantity: 1,
        unitPrice: 2500,
        discount: 0,
        recargo: 0,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('item completo es válido', !error, error?.message);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);