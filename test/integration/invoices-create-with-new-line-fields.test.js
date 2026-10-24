// ============================================================
// Test integración: persistencia de campos DGII en invoice_lines
// Patrón B: llamada directa al service (sin HTTP)
// Requiere: Postgres corriendo + DATABASE_URL en .env
// ============================================================

require('dotenv').config();
const sequelize = require('../../src/config/database');
const {
    User,
    Company,
    Sequence,
    Invoice,
    InvoiceLine,
    Subscription,
    AuditLog
} = require('../../src/models');

const invoicesService = require('../../src/modules/invoices/invoices.service');
const authService = require('../../src/modules/auth/auth.service');

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

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        const TEST_RNC = '130999777';
        const TEST_EMAIL = 'step3-test@expedinap.com';

        // ============================================================
        // SETUP usando el flujo real de registerCompany
        // ============================================================
        // Cleanup previo
        await Company.destroy({ where: { rnc: TEST_RNC } });
        await User.destroy({ where: { email: TEST_EMAIL } });

        // Crear company + owner + plan + subscription con el flujo real
        const registered = await authService.registerCompany(
            {
                company: { rnc: TEST_RNC, name: 'Step3 Test Company SRL' },
                owner: {
                    email: TEST_EMAIL,
                    password: 'TestPass123',
                    firstName: 'Step3',
                    lastName: 'Tester'
                }
            },
            { ip: '127.0.0.1', userAgent: 'test' }
        );

        const company = registered.company;
        const owner = registered.user;

        // Asegurar status activo (por si registerCompany deja 'trial')
        await Subscription.update(
            { status: 'active', invoicesUsedThisMonth: 0 },
            { where: { companyId: company.id } }
        );

        // Crear secuencia tipo 31
        await Sequence.create({
            companyId: company.id,
            type: '31',
            prefix: 'E31',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            isActive: true,
            expiresAt: new Date('2027-12-31')
        });

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: factura 31 con bien (unidad 43)
        // ============================================================
        console.log('--- Test 1: factura 31 con bien (unidad 43) ---');
        {
            const result = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Empresa Compradora SRL',
                    items: [{
                        itemCode: 'PROD-001',
                        itemName: 'Laptop HP 15.6"',
                        description: 'Laptop HP, 8GB RAM, 256GB SSD',
                        indicadorBienoServicio: 1,
                        unidadMedida: 43,
                        quantity: 1,
                        unitPrice: 25000,
                        discount: 0,
                        recargo: 0,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const inv = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            const line = inv.lines[0];
            test('item_name persisted', line.itemName === 'Laptop HP 15.6"', line.itemName);
            test('description persisted', line.description === 'Laptop HP, 8GB RAM, 256GB SSD');
            test('indicador_bieno_servicio = 1', line.indicadorBienoServicio === 1);
            test('unidad_medida = 43', line.unidadMedida === 43);
            test('recargo = 0', Number(line.recargo) === 0);
            test('grados_alcohol = null', line.gradosAlcohol === null);
            test('cantidad_referencia = null', line.cantidadReferencia === null);
            test('unidad_referencia = null', line.unidadReferencia === null);
        }

        // ============================================================
        // TEST 2: factura 31 con servicio
        // ============================================================
        console.log('\n--- Test 2: factura 31 con servicio ---');
        {
            const result = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Empresa Compradora SRL',
                    items: [{
                        itemName: 'Servicio de consultoría',
                        description: 'Consultoría DGII por 10 horas',
                        indicadorBienoServicio: 2,
                        unidadMedida: null,
                        quantity: 10,
                        unitPrice: 1500,
                        discount: 0,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const inv = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            const line = inv.lines[0];
            test('item_name persisted', line.itemName === 'Servicio de consultoría');
            test('indicador_bieno_servicio = 2', line.indicadorBienoServicio === 2);
            test('unidad_medida = null', line.unidadMedida === null);
            test('recargo = 0', Number(line.recargo) === 0);
        }

        // ============================================================
        // TEST 3: factura 31 con recargo
        // ============================================================
        console.log('\n--- Test 3: factura 31 con recargo ---');
        let invoice3;
        {
            const result = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Empresa Compradora SRL',
                    items: [{
                        itemName: 'Producto con recargo',
                        indicadorBienoServicio: 1,
                        unidadMedida: 43,
                        quantity: 1,
                        unitPrice: 1000,
                        discount: 100,
                        recargo: 200,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            invoice3 = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            const line = invoice3.lines[0];
            test('recargo = 200', Number(line.recargo) === 200);
            test('itbis_amount = 198', Number(line.itbisAmount) === 198);
            test('total = 1298', Number(line.total) === 1298);
        }

        // ============================================================
        // TEST 4: update reemplaza líneas conservando campos nuevos
        // ============================================================
        console.log('\n--- Test 4: update de factura draft ---');
        {
            await invoicesService.updateMyInvoice(
                company.id,
                invoice3.id,
                {
                    items: [{
                        itemName: 'Producto actualizado',
                        indicadorBienoServicio: 1,
                        unidadMedida: 34,
                        quantity: 2,
                        unitPrice: 500,
                        discount: 0,
                        recargo: 0,
                        gradosAlcohol: null,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const updated = await Invoice.findByPk(invoice3.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            const line = updated.lines[0];
            test('item_name updated', line.itemName === 'Producto actualizado');
            test('unidad_medida = 34', line.unidadMedida === 34);
            test('recargo = 0 (nuevo valor)', Number(line.recargo) === 0);
            test('solo hay 1 línea', updated.lines.length === 1);
        }

        // ============================================================
        // TEST 5: licor con gradosAlcohol + fechas
        // ============================================================
        console.log('\n--- Test 5: licor con gradosAlcohol y fechas ---');
        {
            const result = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Empresa Compradora SRL',
                    items: [{
                        itemName: 'Whisky Old Parr 750ml',
                        description: 'Botella 750ml, edición especial',
                        indicadorBienoServicio: 1,
                        unidadMedida: 5,
                        gradosAlcohol: 40,
                        fechaElaboracion: '2025-01-15',
                        fechaVencimientoItem: '2030-01-15',
                        cantidadReferencia: 750,
                        unidadReferencia: 59,
                        precioUnitarioReferencia: 2700,
                        quantity: 1,
                        unitPrice: 2500,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const inv = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            const line = inv.lines[0];
            test('grados_alcohol = 40', Number(line.gradosAlcohol) === 40);
            test('fecha_elaboracion persisted', !!line.fechaElaboracion);
            test('fecha_vencimiento_item persisted', !!line.fechaVencimientoItem);
            test('cantidad_referencia = 750', Number(line.cantidadReferencia) === 750);
            test('unidad_referencia = 59', line.unidadReferencia === 59);
            test('precio_unitario_referencia = 2700', Number(line.precioUnitarioReferencia) === 2700);
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            const TEST_RNC = '130999777';
            const TEST_EMAIL = 'step3-test@expedinap.com';
            const company = await Company.findOne({ where: { rnc: TEST_RNC } });
            if (company) {
                const users = await User.findAll({ where: { companyId: company.id } });
                for (const u of users) {
                    await AuditLog.destroy({ where: { userId: u.id } });
                }
                const invoices = await Invoice.findAll({ where: { companyId: company.id } });
                for (const inv of invoices) {
                    await InvoiceLine.destroy({ where: { invoiceId: inv.id } });
                    await AuditLog.destroy({ where: { entityId: inv.id } });
                }
                await Invoice.destroy({ where: { companyId: company.id } });
                await Sequence.destroy({ where: { companyId: company.id } });
                await Subscription.destroy({ where: { companyId: company.id } });
                await User.destroy({ where: { companyId: company.id } });
                await Company.destroy({ where: { id: company.id } });
            }
            await User.destroy({ where: { email: TEST_EMAIL } });
            console.log('\n🧹 Cleaned up');
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
        process.exit(failed > 0 ? 1 : 0);
    }
})();