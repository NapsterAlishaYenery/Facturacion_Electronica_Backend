// ============================================================
// Test integración: pos.service.createQuickInvoice (Step P5)
// Requiere: Postgres corriendo
// ============================================================

require('dotenv').config();
const sequelize = require('../../src/config/database');
const {
    User,
    Company,
    Product,
    Sequence,
    Invoice,
    InvoiceLine,
    Subscription,
    AuditLog
} = require('../../src/models');

const posService = require('../../src/modules/pos/pos.service');
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

        const TEST_RNC = '130999333';
        const TEST_EMAIL = 'step-p5-pos@expedinap.com';

        await Company.destroy({ where: { rnc: TEST_RNC } });
        await User.destroy({ where: { email: TEST_EMAIL } });

        const registered = await authService.registerCompany(
            {
                company: { rnc: TEST_RNC, name: 'P5 POS Test SRL' },
                owner: {
                    email: TEST_EMAIL,
                    password: 'TestPass123',
                    firstName: 'P5',
                    lastName: 'Tester'
                }
            },
            { ip: '127.0.0.1', userAgent: 'test' }
        );
        const company = registered.company;
        const owner = registered.user;

        await Subscription.update(
            { status: 'active', invoicesUsedThisMonth: 0 },
            { where: { companyId: company.id } }
        );

        // Secuencias 31 y 32
        for (const t of ['31', '32']) {
            await Sequence.create({
                companyId: company.id,
                type: t,
                prefix: `E${t}`,
                startNumber: 1,
                endNumber: 100,
                currentNumber: 0,
                isActive: true,
                expiresAt: new Date('2027-12-31')
            });
        }

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: factura 31 con ítem de catálogo (Bien)
        // ============================================================
        console.log('--- Test 1: 31 con bien de catálogo ---');
        let productBien;
        {
            const created = await Product.create({
                companyId: company.id,
                name: 'Laptop HP',
                price: 25000,
                taxType: 'ITBIS_18',
                indicadorBienoServicio: 1,
                unidadMedida: 43,
                isActive: true
            });
            productBien = created;

            const result = await posService.createQuickInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Comprador SRL',
                    items: [{
                        productId: productBien.id,
                        quantity: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const full = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });
            const line = full.lines[0];

            test('factura 31 creada', full.type === '31');
            test('itemName propagado', line.itemName === 'Laptop HP');
            test('indicadorBienoServicio = 1', line.indicadorBienoServicio === 1);
            test('unidadMedida = 43', line.unidadMedida === 43);
        }

        // ============================================================
        // TEST 2: factura 31 con ítem manual (Servicio)
        // ============================================================
        console.log('\n--- Test 2: 31 con servicio manual ---');
        {
            const result = await posService.createQuickInvoice(
                company.id,
                {
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
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const full = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });
            const line = full.lines[0];

            test('servicio 2', line.indicadorBienoServicio === 2);
            test('sin unidadMedida', line.unidadMedida === null);
            test('itemName = Consultoría', line.itemName === 'Consultoría');
        }

        // ============================================================
        // TEST 3: factura 31 con licor completo
        // ============================================================
        console.log('\n--- Test 3: 31 con licor ---');
        {
            const result = await posService.createQuickInvoice(
                company.id,
                {
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
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const full = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });
            const line = full.lines[0];

            test('gradosAlcohol = 40', Number(line.gradosAlcohol) === 40);
            test('cantidadReferencia = 750', Number(line.cantidadReferencia) === 750);
            test('unidadReferencia = 59', line.unidadReferencia === 59);
            test('fechaElaboracion presente', !!line.fechaElaboracion);
            test('fechaVencimientoItem presente', !!line.fechaVencimientoItem);
        }

        // ============================================================
        // TEST 4: factura 32 sin RNC (consumo)
        // ============================================================
        console.log('\n--- Test 4: 32 sin RNC ---');
        {
            const result = await posService.createQuickInvoice(
                company.id,
                {
                    type: '32',
                    items: [{
                        itemName: 'Arroz Selecto 1kg',
                        quantity: 3,
                        unitPrice: 150,
                        taxType: 'ITBIS_18',
                        indicadorBienoServicio: 1,
                        unidadMedida: 21
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const full = await Invoice.findByPk(result.invoice.id, {
                include: [{ model: InvoiceLine, as: 'lines' }]
            });

            test('factura 32 creada', full.type === '32');
            test('unidadMedida = 21 (kg)', full.lines[0].unidadMedida === 21);
        }

        // ============================================================
        // TEST 5: tipo 46 rechazado
        // ============================================================
        console.log('\n--- Test 5: tipo 46 rechazado ---');
        {
            let errorCode = null;
            try {
                await posService.createQuickInvoice(
                    company.id,
                    {
                        type: '46',
                        receiverRnc: '130999888',
                        receiverName: 'Exportador',
                        items: [{
                            itemName: 'X',
                            quantity: 1,
                            unitPrice: 100,
                            taxType: 'ITBIS_18'
                        }]
                    },
                    owner,
                    { ip: '127.0.0.1', userAgent: 'test' }
                );
            } catch (e) {
                errorCode = e.code || e.message;
            }

            test('rechaza tipo 46', errorCode !== null);
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            const TEST_RNC = '130999333';
            const TEST_EMAIL = 'step-p5-pos@expedinap.com';
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
                await Product.destroy({ where: { companyId: company.id } });
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