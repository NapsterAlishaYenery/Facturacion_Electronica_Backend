// ============================================================
// Test unitario: itemSchema (Step 1 — InvoiceLine DGII fields)
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

// Helper: arma un payload válido de tipo 31 con la línea dada
function buildPayload(items) {
    return {
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Empresa Compradora SRL',
        items
    };
}

// Helper: valida y devuelve el resultado
function validate(payload) {
    return createInvoiceSchema.validate(payload, { abortEarly: false });
}

console.log('=== TESTS: itemSchema (Step 1) ===\n');

// ------------------------------------------------------------
// 1. Item mínimo válido
// ------------------------------------------------------------
console.log('--- Caso 1: item mínimo válido ---');
{
    const { error, value } = validate(buildPayload([{
        itemName: 'Servicio profesional',
        quantity: 1,
        unitPrice: 1000,
        indicadorBienoServicio: 2,
        itbisRate: 18
    }]));

    test('no error', !error, error?.message);
    test('indicadorBienoServicio = 2', value?.items?.[0]?.indicadorBienoServicio === 2);
    test('description undefined (opcional)', value?.items?.[0]?.description === undefined);
    test('unidadMedida undefined', value?.items?.[0]?.unidadMedida === undefined);
    test('recargo = 0 (default)', value?.items?.[0]?.recargo === 0);
    test('discount = 0 (default)', value?.items?.[0]?.discount === 0);
}

// ------------------------------------------------------------
// 2. Item completo con todos los campos nuevos
// ------------------------------------------------------------
console.log('\n--- Caso 2: item completo ---');
{
    const { error, value } = validate(buildPayload([{
        itemCode: 'LIC-001',
        itemName: 'Whisky Old Parr',
        description: 'Botella 750ml, edición especial',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        quantity: 2,
        unitPrice: 2500,
        discount: 100,
        recargo: 50,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        gradosAlcohol: 40,
        precioUnitarioReferencia: 2700,
        fechaElaboracion: '2025-01-15',
        fechaVencimientoItem: '2030-01-15',
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));

    test('no error', !error, error?.message);
    const it = value?.items?.[0];
    test('itemCode preserved', it?.itemCode === 'LIC-001');
    test('itemName preserved', it?.itemName === 'Whisky Old Parr');
    test('description preserved', it?.description === 'Botella 750ml, edición especial');
    test('indicadorBienoServicio = 1', it?.indicadorBienoServicio === 1);
    test('unidadMedida = 5', it?.unidadMedida === 5);
    test('recargo = 50', it?.recargo === 50);
    test('cantidadReferencia = 750', it?.cantidadReferencia === 750);
    test('unidadReferencia = 59', it?.unidadReferencia === 59);
    test('gradosAlcohol = 40', it?.gradosAlcohol === 40);
    test('precioUnitarioReferencia = 2700', it?.precioUnitarioReferencia === 2700);
    test('fechaElaboracion preserved', it?.fechaElaboracion instanceof Date);
    test('fechaVencimientoItem preserved', it?.fechaVencimientoItem instanceof Date);
}

// ------------------------------------------------------------
// 3. Rechaza indicadorBienoServicio fuera de [1,2]
// ------------------------------------------------------------
console.log('\n--- Caso 3: indicadorBienoServicio inválido ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 3,
        itbisRate: 18
    }]));
    test('error por indicadorBienoServicio=3', !!error);
    test('mensaje menciona 1 (Bien) o 2 (Servicio)',
        error?.message?.includes('1 (Bien) or 2 (Servicio)'));
}

// ------------------------------------------------------------
// 4. Rechaza unidadMedida fuera de [1,62]
// ------------------------------------------------------------
console.log('\n--- Caso 4: unidadMedida fuera de rango ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 63,
        itbisRate: 18
    }]));
    test('error por unidadMedida=63', !!error);
    test('mensaje menciona 1 y 62',
        error?.message?.includes('1 and 62'));
}
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 0,
        itbisRate: 18
    }]));
    test('error por unidadMedida=0', !!error);
}

// ------------------------------------------------------------
// 5. Rechaza gradosAlcohol > 100
// ------------------------------------------------------------
console.log('\n--- Caso 5: gradosAlcohol > 100 ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        gradosAlcohol: 150,
        itbisRate: 18
    }]));
    test('error por gradosAlcohol=150', !!error);
    test('mensaje menciona 100',
        error?.message?.includes('100'));
}

// ------------------------------------------------------------
// 6. Rechaza itemName vacío o > 80 chars
// ------------------------------------------------------------
console.log('\n--- Caso 6: itemName inválido ---');
{
    const { error } = validate(buildPayload([{
        itemName: '',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        itbisRate: 18
    }]));
    test('error por itemName vacío', !!error);
}
{
    const { error } = validate(buildPayload([{
        itemName: 'X'.repeat(81),
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        itbisRate: 18
    }]));
    test('error por itemName > 80', !!error);
    test('mensaje menciona 80',
        error?.message?.includes('80'));
}
{
    const { error } = validate(buildPayload([{
        itemName: 'X'.repeat(80),
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        itbisRate: 18
    }]));
    test('itemName de 80 chars es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 7. Backward-compat: indicadorFacturacion ↔ itbisRate sigue funcionando
// ------------------------------------------------------------
console.log('\n--- Caso 7: backward-compat itbisRate ---');
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        itbisRate: 18,
        indicadorFacturacion: 1
    }]));
    test('18% + indicador 1 es válido', !error, error?.message);
}
{
    const { error } = validate(buildPayload([{
        itemName: 'Test',
        quantity: 1,
        unitPrice: 100,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        itbisRate: 16,
        indicadorFacturacion: 1
    }]));
    test('16% + indicador 1 → error de coherencia', !!error);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);