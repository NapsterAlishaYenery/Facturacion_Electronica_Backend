// ============================================================
// Test unitario: pos.validation (Step P4)
// ============================================================

const {
    quickInvoiceSchema,
    POS_TAX_TYPES,
    POS_INVOICE_TYPES
} = require('../../src/modules/pos/pos.validation');

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
    return quickInvoiceSchema.validate(payload, { abortEarly: false });
}

console.log('=== TESTS: pos.validation (Step P4) ===\n');

// ------------------------------------------------------------
// 1. Constantes correctas
// ------------------------------------------------------------
console.log('--- Caso 1: constantes ---');
test('POS_INVOICE_TYPES = [31, 32]',
    POS_INVOICE_TYPES.length === 2
    && POS_INVOICE_TYPES.includes('31')
    && POS_INVOICE_TYPES.includes('32'));
test('POS_TAX_TYPES = [ITBIS_18, ITBIS_16, EXENTO]',
    POS_TAX_TYPES.length === 3
    && POS_TAX_TYPES.includes('ITBIS_18')
    && POS_TAX_TYPES.includes('ITBIS_16')
    && POS_TAX_TYPES.includes('EXENTO'));
test('POS_TAX_TYPES NO incluye ITBIS_3',
    !POS_TAX_TYPES.includes('ITBIS_3'));

// ------------------------------------------------------------
// 2. Tipo 46 rechazado (POS solo 31/32)
// ------------------------------------------------------------
console.log('\n--- Caso 2: tipo 46 rechazado ---');
{
    const { error } = validate({
        type: '46',
        receiverRnc: '130999888',
        receiverName: 'Exportador',
        items: [{ itemName: 'X', quantity: 1, unitPrice: 100, taxType: 'ITBIS_18' }]
    });
    test('rechaza tipo 46', !!error);
}

// ------------------------------------------------------------
// 3. Tipo 31 con ítem manual mínimo
// ------------------------------------------------------------
console.log('\n--- Caso 3: 31 con ítem manual ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Laptop HP',
            quantity: 1,
            unitPrice: 25000,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 1,
            unidadMedida: 43
        }]
    });
    test('31 con bien es válido', !error, error?.message);
}

// ------------------------------------------------------------
// 4. Bien sin unidadMedida → error
// ------------------------------------------------------------
console.log('\n--- Caso 4: Bien sin unidadMedida ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Laptop HP',
            quantity: 1,
            unitPrice: 25000,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 1
        }]
    });
    test('error por bien sin unidadMedida', !!error);
}

// ------------------------------------------------------------
// 5. Servicio sin unidadMedida → OK
// ------------------------------------------------------------
console.log('\n--- Caso 5: Servicio sin unidadMedida ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Consultoría',
            quantity: 5,
            unitPrice: 1500,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 2
        }]
    });
    test('servicio válido', !error, error?.message);
}

// ------------------------------------------------------------
// 6. Servicio con gradosAlcohol → error
// ------------------------------------------------------------
console.log('\n--- Caso 6: Servicio con gradosAlcohol ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Servicio',
            quantity: 1,
            unitPrice: 100,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 2,
            gradosAlcohol: 40
        }]
    });
    test('error por gradosAlcohol en servicio', !!error);
}

// ------------------------------------------------------------
// 7. Licor completo válido
// ------------------------------------------------------------
console.log('\n--- Caso 7: Licor completo ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Whisky Old Parr',
            description: 'Botella 750ml',
            quantity: 1,
            unitPrice: 2500,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 1,
            unidadMedida: 5,
            gradosAlcohol: 40,
            cantidadReferencia: 750,
            unidadReferencia: 59,
            precioUnitarioReferencia: 2700,
            fechaElaboracion: '2025-01-15',
            fechaVencimientoItem: '2030-01-15'
        }]
    });
    test('licor completo válido', !error, error?.message);
}

// ------------------------------------------------------------
// 8. ITBIS_3 rechazado
// ------------------------------------------------------------
console.log('\n--- Caso 8: ITBIS_3 rechazado ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Producto',
            quantity: 1,
            unitPrice: 100,
            taxType: 'ITBIS_3',
            indicadorBienoServicio: 1,
            unidadMedida: 43
        }]
    });
    test('rechaza ITBIS_3', !!error);
}

// ------------------------------------------------------------
// 9. Item de catálogo (productId)
// ------------------------------------------------------------
console.log('\n--- Caso 9: ítem de catálogo ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            productId: '00000000-0000-0000-0000-000000000001',
            quantity: 2
        }]
    });
    test('ítem de catálogo válido', !error, error?.message);
}

// ------------------------------------------------------------
// 10. Fechas invertidas → error
// ------------------------------------------------------------
console.log('\n--- Caso 10: fechaVencimiento < fechaElaboracion ---');
{
    const { error } = validate({
        type: '31',
        receiverRnc: '130999888',
        receiverName: 'Comprador SRL',
        items: [{
            itemName: 'Medicina',
            quantity: 1,
            unitPrice: 100,
            taxType: 'ITBIS_18',
            indicadorBienoServicio: 1,
            unidadMedida: 5,
            fechaElaboracion: '2030-01-15',
            fechaVencimientoItem: '2025-01-15'
        }]
    });
    test('error por fechas invertidas', !!error);
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);