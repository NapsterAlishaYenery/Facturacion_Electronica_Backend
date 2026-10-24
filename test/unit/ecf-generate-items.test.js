// ============================================================
// Test unitario: buildItems del XML generator (Step 5)
// SIN validación XSD (entorno Windows + Node 24 no soporta libxmljs)
// La validación XSD se hará en el entorno de producción con cert.
// ============================================================

const {
    generateECF31,
    generateECF32
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

// Helper: construye un payload tipo 31 válido
function buildInvoice31(line) {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    const disc = Number(line.discount || 0);
    const recargo = Number(line.recargo || 0);
    const rate = Number(line.itbisRate || 18) / 100;
    const base = qty * price - disc + recargo;
    const itbis = base * rate;
    const total = base + itbis;

    return {
        type: '31',
        ncf: 'E310000000001',
        sequenceExpiresAt: new Date('2026-12-31'),
        issuerRnc: '02800918407',
        issuerName: 'Emisor Test SRL',
        issuerAddress: 'Calle Test #1',
        issuerMunicipio: '110100',
        issuerProvincia: '110000',
        receiverRnc: '130999888',
        receiverName: 'Comprador Test SRL',
        issuedAt: new Date('2026-10-24T10:00:00'),
        paymentType: 1,
        paymentMethods: [{ method: 1, amount: total }],
        subtotal: base,
        itbis,
        total,
        itbis1Base: base,
        itbis1Amount: itbis,
        montoGravado: base,
        lines: [{
            lineNumber: 1,
            itemCode: line.itemCode || null,
            itemName: line.itemName,
            description: line.description ?? null,
            indicadorBienoServicio: line.indicadorBienoServicio ?? 1,
            unidadMedida: line.unidadMedida ?? null,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discount: line.discount || 0,
            recargo: line.recargo || 0,
            itbisRate: line.itbisRate || 18,
            indicadorFacturacion: line.indicadorFacturacion || 1,
            gradosAlcohol: line.gradosAlcohol ?? null,
            cantidadReferencia: line.cantidadReferencia ?? null,
            unidadReferencia: line.unidadReferencia ?? null,
            precioUnitarioReferencia: line.precioUnitarioReferencia ?? null,
            fechaElaboracion: line.fechaElaboracion ?? null,
            fechaVencimientoItem: line.fechaVencimientoItem ?? null
        }]
    };
}

console.log('=== TESTS: buildItems (Step 5, sin XSD) ===\n');

// 1. Bien con unidadMedida 43
console.log('--- Caso 1: Bien con unidadMedida 43 ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Laptop HP',
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 25000,
        itbisRate: 18
    }));
    test('<IndicadorBienoServicio>1', xml.includes('<IndicadorBienoServicio>1</IndicadorBienoServicio>'));
    test('<UnidadMedida>43', xml.includes('<UnidadMedida>43</UnidadMedida>'));
    test('<NombreItem>Laptop HP', xml.includes('<NombreItem>Laptop HP</NombreItem>'));
    test('NO <IndicadorBienoServicio>2', !xml.includes('<IndicadorBienoServicio>2</IndicadorBienoServicio>'));
}

// 2. Servicio sin unidadMedida
console.log('\n--- Caso 2: Servicio sin unidadMedida ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Consultoría DGII',
        indicadorBienoServicio: 2,
        unidadMedida: null,
        quantity: 10,
        unitPrice: 1500,
        itbisRate: 18
    }));
    test('<IndicadorBienoServicio>2', xml.includes('<IndicadorBienoServicio>2</IndicadorBienoServicio>'));
    test('NO <UnidadMedida>', !xml.includes('<UnidadMedida>'));
}

// 3. Recargo 50
console.log('\n--- Caso 3: recargo 50 ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Producto con recargo',
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 1000,
        recargo: 50,
        itbisRate: 18
    }));
    test('<RecargoMonto>50.00', xml.includes('<RecargoMonto>50.00</RecargoMonto>'));
    test('<MontoItem>1050.00', xml.includes('<MontoItem>1050.00</MontoItem>'));
}

// 4. gradosAlcohol en tipo 32
console.log('\n--- Caso 4: gradosAlcohol tipo 32 ---');
{
    const invoice32 = {
        type: '32',
        ncf: 'E320000000001',
        issuerRnc: '02800918407',
        issuerName: 'Emisor Test SRL',
        issuerAddress: 'Calle Test #1',
        issuerMunicipio: '110100',
        issuerProvincia: '110000',
        receiverRnc: null,
        receiverName: null,
        issuedAt: new Date('2026-10-24T10:00:00'),
        paymentType: 1,
        paymentMethods: [{ method: 1, amount: 2950 }],
        subtotal: 2500,
        itbis: 450,
        total: 2950,
        itbis1Base: 2500,
        itbis1Amount: 450,
        montoGravado: 2500,
        lines: [{
            lineNumber: 1,
            itemName: 'Whisky Old Parr',
            description: null,
            indicadorBienoServicio: 1,
            unidadMedida: 5,
            quantity: 1,
            unitPrice: 2500,
            discount: 0,
            recargo: 0,
            gradosAlcohol: 40,
            itbisRate: 18,
            indicadorFacturacion: 1
        }]
    };
    const xml = generateECF32(invoice32);
    test('<GradosAlcohol>40.00', xml.includes('<GradosAlcohol>40.00</GradosAlcohol>'));
}

// 5. Sin gradosAlcohol → NO se escribe
console.log('\n--- Caso 5: sin gradosAlcohol ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Laptop sin alcohol',
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 25000,
        itbisRate: 18
    }));
    test('NO <GradosAlcohol>', !xml.includes('<GradosAlcohol>'));
}

// 6. description vacío → NO DescripcionItem
console.log('\n--- Caso 6: description vacío ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Item sin descripción',
        description: null,
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 100,
        itbisRate: 18
    }));
    test('NO <DescripcionItem>', !xml.includes('<DescripcionItem>'));
}

// 7. description distinto → SÍ
console.log('\n--- Caso 7: description distinta ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Whisky',
        description: 'Botella 750ml edición especial',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18
    }));
    test('<DescripcionItem>Botella 750ml', xml.includes('<DescripcionItem>Botella 750ml edición especial</DescripcionItem>'));
}

// 8. description igual → NO se duplica
console.log('\n--- Caso 8: description igual a itemName ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Laptop HP',
        description: 'Laptop HP',
        indicadorBienoServicio: 1,
        unidadMedida: 43,
        quantity: 1,
        unitPrice: 25000,
        itbisRate: 18
    }));
    test('NO se duplica <DescripcionItem>', !xml.includes('<DescripcionItem>'));
}

// 9. Referencias
console.log('\n--- Caso 9: referencias (750ml / 59) ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Whisky 750ml',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        cantidadReferencia: 750,
        unidadReferencia: 59,
        quantity: 1,
        unitPrice: 2500,
        itbisRate: 18
    }));
    test('<CantidadReferencia>750.00', xml.includes('<CantidadReferencia>750.00</CantidadReferencia>'));
    test('<UnidadReferencia>59', xml.includes('<UnidadReferencia>59</UnidadReferencia>'));
}

// 10. Fechas
console.log('\n--- Caso 10: fechas ---');
{
    const xml = generateECF31(buildInvoice31({
        itemName: 'Medicina',
        indicadorBienoServicio: 1,
        unidadMedida: 5,
        fechaElaboracion: new Date('2025-01-15'),
        fechaVencimientoItem: new Date('2030-01-15'),
        quantity: 1,
        unitPrice: 500,
        itbisRate: 18
    }));
    test('<FechaElaboracion>15-01-2025', xml.includes('<FechaElaboracion>15-01-2025</FechaElaboracion>'));
    test('<FechaVencimientoItem>15-01-2030', xml.includes('<FechaVencimientoItem>15-01-2030</FechaVencimientoItem>'));
}

console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);