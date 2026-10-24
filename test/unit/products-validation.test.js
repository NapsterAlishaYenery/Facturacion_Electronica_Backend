// ============================================================
// Test unitario: products.validation (Step P2)
// Verifica reglas cruzadas DGII en Product
// ============================================================

const {
    createProductSchema,
    updateProductSchema
} = require('../../src/modules/pos/products/products.validation');

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

function validate(payload) {
    return createProductSchema.validate(payload, { abortEarly: false });
}

function validateUpdate(payload) {
    return updateProductSchema.validate(payload, { abortEarly: false });
}

console.log('=== TESTS: products.validation (Step P2) ===\n');

// ------------------------------------------------------------
// 1. Producto mínimo válido: BIEN con unidadMedida
// ------------------------------------------------------------
console.log('--- Caso 1: Bien válido ---');
{
    const { error } = validate({
        name: 'Laptop HP',
        price: 25000,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 1,
        unidadMedida: 43
    });
    test('Bien válido', !error, error?.message);
}

// ------------------------------------------------------------
// 2. Bien SIN unidadMedida → error
// ------------------------------------------------------------
console.log('\n--- Caso 2: Bien sin unidadMedida ---');
{
    const { error } = validate({
        name: 'Laptop HP',
        price: 25000,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 1
    });
    test('error por Bien sin unidadMedida', !!error);
    test('mensaje menciona unidadMedida',
        error?.message?.includes('unidadMedida is required'));
}

// ------------------------------------------------------------
// 3. Servicio sin unidadMedida → OK
// ------------------------------------------------------------
console.log('\n--- Caso 3: Servicio sin unidadMedida ---');
{
    const { error } = validate({
        name: 'Consultoría DGII',
        price: 1500,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 2
    });
    test('Servicio sin unidadMedida es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 4. Servicio CON gradosAlcohol → error
// ------------------------------------------------------------
console.log('\n--- Caso 4: Servicio con gradosAlcohol ---');
{
    const { error } = validate({
        name: 'Consultoría',
        price: 1500,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 2,
        gradosAlcohol: 40
    });
    test('error por gradosAlcohol en servicio', !!error);
    test('mensaje menciona gradosAlcohol',
        error?.message?.includes('gradosAlcohol only applies to bienes'));
}

// ------------------------------------------------------------
// 5. Licor completo válido
// ------------------------------------------------------------
console.log('\n--- Caso 5: Licor completo ---');
{
    const { error } = validate({
        name: 'Whisky Old Parr 750ml',
        description: 'Botella 750ml',
        price: 2500,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        gradosAlcohol: 40,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        precioUnitarioReferencia: 2700,
        fechaElaboracion: '2025-01-15',
        fechaVencimientoItem: '2030-01-15'
    });
    test('Licor completo válido', !error, error?.message);
}

// ------------------------------------------------------------
// 6. cantidadReferencia sin unidadReferencia → error
// ------------------------------------------------------------
console.log('\n--- Caso 6: cantidadReferencia sin unidadReferencia ---');
{
    const { error } = validate({
        name: 'Bien con ref',
        price: 1000,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750
    });
    test('error por cantidadReferencia sin unidadReferencia', !!error);
    test('mensaje menciona unidadReferencia',
        error?.message?.includes('unidadReferencia is required'));
}

// ------------------------------------------------------------
// 7. fechaVencimiento < fechaElaboracion → error
// ------------------------------------------------------------
console.log('\n--- Caso 7: fechaVencimiento < fechaElaboracion ---');
{
    const { error } = validate({
        name: 'Medicina',
        price: 500,
        taxType: 'ITBIS_18',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        fechaElaboracion: '2030-01-15',
        fechaVencimientoItem: '2025-01-15'
    });
    test('error por fechaVencimiento < fechaElaboracion', !!error);
}

// ------------------------------------------------------------
// 8. taxType ITBIS_3_46 ya no está permitido
// ------------------------------------------------------------
console.log('\n--- Caso 8: taxType ITBIS_3_46 rechazado ---');
{
    const { error } = validate({
        name: 'Producto',
        price: 100,
        taxType: 'ITBIS_3_46',
        indicadorBienoServicio: 1,
        unidadMedida: 43
    });
    test('error por ITBIS_3_46', !!error);
    test('mensaje menciona taxType',
        error?.message?.includes('taxType must be one of'));
}

// ------------------------------------------------------------
// 9. indicadorBienoServicio es requerido
// ------------------------------------------------------------
console.log('\n--- Caso 9: indicadorBienoServicio requerido ---');
{
    const { error } = validate({
        name: 'Producto',
        price: 100,
        taxType: 'ITBIS_18'
    });
    test('error por falta indicadorBienoServicio', !!error);
    test('mensaje menciona indicadorBienoServicio',
        error?.message?.includes('indicadorBienoServicio is required'));
}

// ------------------------------------------------------------
// 10. Update parcial simple: solo precio → OK
// ------------------------------------------------------------
console.log('\n--- Caso 10: update parcial solo precio ---');
{
    const { error } = validateUpdate({ price: 500 });
    test('update de solo precio es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 11. Update parcial: service con gradosAlcohol → error
// ------------------------------------------------------------
console.log('\n--- Caso 11: update de servicio con gradosAlcohol ---');
{
    const { error } = validateUpdate({
        indicadorBienoServicio: 2,
        gradosAlcohol: 40
    });
    test('error por gradosAlcohol en servicio (update)', !!error);
}

// ------------------------------------------------------------
// 12. Update vacío → error
// ------------------------------------------------------------
console.log('\n--- Caso 12: update vacío ---');
{
    const { error } = validateUpdate({});
    test('error por update vacío', !!error);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);