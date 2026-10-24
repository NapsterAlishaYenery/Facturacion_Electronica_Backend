// ============================================================
// Test integración: respuestas API incluyen campos DGII (Step 7)
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

        const TEST_RNC = '130999555';
        const TEST_EMAIL = 'step7-test@expedinap.com';

        await Company.destroy({ where: { rnc: TEST_RNC } });
        await User.destroy({ where: { email: TEST_EMAIL } });

        const registered = await authService.registerCompany(
            {
                company: { rnc: TEST_RNC, name: 'Step7 Test Company SRL' },
                owner: {
                    email: TEST_EMAIL,
                    password: 'TestPass123',
                    firstName: 'Step7',
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
        // Crear factura 31 con un ítem completo (todos los campos nuevos)
        // ============================================================
        let invoiceId;
        {
            const created = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Comprador Test SRL',
                    items: [{
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
                        recargo: 100,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );
            invoiceId = created.invoice.id;
        }

        // ============================================================
        // TEST 1: getMyInvoiceById expone los campos nuevos en lines
        // ============================================================
        console.log('--- Test 1: getMyInvoiceById expone campos nuevos ---');
        {
            const result = await invoicesService.getMyInvoiceById(company.id, invoiceId);
            const line = result.invoice.lines?.[0];

            test('líneas presentes', !!line);
            test('itemName expuesto', line?.itemName === 'Whisky Old Parr 750ml', line?.itemName);
            test('description expuesta',
                line?.description === 'Botella 750ml, edición especial');
            test('indicadorBienoServicio = 1', line?.indicadorBienoServicio === 1);
            test('unidadMedida = 5', line?.unidadMedida === 5);
            test('cantidadReferencia = 750', Number(line?.cantidadReferencia) === 750);
            test('unidadReferencia = 59', line?.unidadReferencia === 59);
            test('gradosAlcohol = 40', Number(line?.gradosAlcohol) === 40);
            test('precioUnitarioReferencia = 2700',
                Number(line?.precioUnitarioReferencia) === 2700);
            test('fechaElaboracion presente', !!line?.fechaElaboracion);
            test('fechaVencimientoItem presente', !!line?.fechaVencimientoItem);
            test('recargo = 100', Number(line?.recargo) === 100);
            test('itemCode expuesto', line?.itemCode === 'LIC-001');
            test('XML expuesto en detalle (xmlContent)',
                result.invoice.xmlContent !== undefined);
        }

        // ============================================================
        // TEST 2: getInvoiceById (admin) expone los mismos campos
        // ============================================================
        console.log('\n--- Test 2: getInvoiceById (admin) expone campos nuevos ---');
        {
            const result = await invoicesService.getInvoiceById(invoiceId);
            const line = result.invoice.lines?.[0];

            test('líneas presentes', !!line);
            test('itemName expuesto', line?.itemName === 'Whisky Old Parr 750ml');
            test('indicadorBienoServicio = 1', line?.indicadorBienoServicio === 1);
            test('unidadMedida = 5', line?.unidadMedida === 5);
            test('gradosAlcohol = 40', Number(line?.gradosAlcohol) === 40);
            test('recargo = 100', Number(line?.recargo) === 100);
            test('company incluida', !!result.invoice.company);
        }

        // ============================================================
        // TEST 3: servicio (indicadorBienoServicio=2) sin unidadMedida
        // ============================================================
        console.log('\n--- Test 3: servicio sin unidadMedida ---');
        {
            const created = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '31',
                    receiverRnc: '130999888',
                    receiverName: 'Comprador Test SRL',
                    items: [{
                        itemName: 'Consultoría DGII',
                        indicadorBienoServicio: 2,
                        unidadMedida: null,
                        quantity: 10,
                        unitPrice: 1500,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const result = await invoicesService.getMyInvoiceById(
                company.id,
                created.invoice.id
            );
            const line = result.invoice.lines?.[0];

            test('servicio: indicadorBienoServicio = 2',
                line?.indicadorBienoServicio === 2);
            test('servicio: unidadMedida null', line?.unidadMedida === null);
            test('servicio: itemName presente', line?.itemName === 'Consultoría DGII');
            test('servicio: gradosAlcohol null', line?.gradosAlcohol === null);
        }

        // ============================================================
        // TEST 4: listMyInvoices NO expone xmlContent (comportamiento esperado)
        // ============================================================
        console.log('\n--- Test 4: listMyInvoices oculta xml (backward-compat) ---');
        {
            const result = await invoicesService.listMyInvoices(company.id, {
                page: 1,
                limit: 10
            });
            const inv = result.items[0];

            test('listado devuelve items', Array.isArray(result.items) && result.items.length > 0);
            test('listado oculta xmlContent', inv?.xmlContent === undefined);
            test('listado oculta xmlSigned', inv?.xmlSigned === undefined);
            test('listado incluye lineCount', typeof inv?.lineCount === 'number');
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            const TEST_RNC = '130999555';
            const TEST_EMAIL = 'step7-test@expedinap.com';
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