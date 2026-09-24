require('dotenv').config();
const sequelize = require('../../src/config/database');
const Invoice = require('../../src/models/invoice.model');
const InvoiceLine = require('../../src/models/invoiceLine.model');
const Company = require('../../src/models/company.model');
const Sequence = require('../../src/models/sequence.model');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Setup: empresa y secuencia
        const company = await Company.create({
            rnc: '130999555',
            name: 'Invoice Test Company'
        });

        const sequence = await Sequence.create({
            companyId: company.id,
            type: '32',
            prefix: 'E',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            expiresAt: new Date('2026-12-31')
        });

        console.log('✅ Setup: company + sequence');

        // 2. Crear factura (encabezado)
        const nextNumber = sequence.currentNumber + 1;
        const ncf = sequence.prefix + sequence.type + String(nextNumber).padStart(10, '0');

        const invoice = await Invoice.create({
            companyId: company.id,
            sequenceId: sequence.id,
            type: '32',
            ncf: ncf,
            status: 'draft',
            issuerRnc: company.rnc,
            issuerName: company.name,
            receiverName: 'Cliente Final',
            subtotal: 269.00,
            itbis: 48.42,
            total: 317.42,
            issuedAt: new Date()
        });

        console.log('✅ Invoice created:', invoice.ncf);

        // 3. Crear 3 líneas (salami, pollo, arroz)
        const lines = await InvoiceLine.bulkCreate([
            {
                invoiceId: invoice.id,
                lineNumber: 1,
                description: 'Salami',
                quantity: 1,
                unitPrice: 100.00,
                itbisRate: 18,
                itbisAmount: 18.00,
                total: 118.00
            },
            {
                invoiceId: invoice.id,
                lineNumber: 2,
                description: 'Pollo',
                quantity: 1,
                unitPrice: 130.00,
                itbisRate: 18,
                itbisAmount: 23.40,
                total: 153.40
            },
            {
                invoiceId: invoice.id,
                lineNumber: 3,
                description: 'Arroz',
                quantity: 1,
                unitPrice: 39.00,
                itbisRate: 18,
                itbisAmount: 7.02,
                total: 46.02
            }
        ]);

        console.log('✅ Lines created:', lines.length);
        lines.forEach(l => {
            console.log(`   ${l.lineNumber}. ${l.description} × ${l.quantity} = ${l.total}`);
        });

        // 4. Actualizar secuencia
        await sequence.update({ currentNumber: nextNumber });
        console.log('✅ Sequence updated to:', sequence.currentNumber);

        // 5. Leer factura con sus líneas
        const invoiceWithLines = await Invoice.findByPk(invoice.id, {
            include: [{ model: InvoiceLine, as: 'lines' }]
        });
        console.log('\n📋 Invoice with lines:');
        console.log('   NCF:', invoiceWithLines.ncf);
        console.log('   Total:', invoiceWithLines.total);
        console.log('   Lines in DB:', invoiceWithLines.lines.length);

        // 6. Probar validación: línea con cantidad negativa
        try {
            await InvoiceLine.create({
                invoiceId: invoice.id,
                lineNumber: 4,
                description: 'Invalid',
                quantity: -1,
                unitPrice: 100,
                total: 100
            });
            console.log('❌ Should have failed (negative quantity)');
        } catch (error) {
            console.log('✅ Validation works (quantity):', error.message);
        }

        // 7. Limpiar
        await invoice.destroy(); // CASCADE borra las líneas
        await sequence.destroy();
        await company.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();