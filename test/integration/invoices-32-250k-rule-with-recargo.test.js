// ============================================================
// Test integración: regla 250K del e-CF 32 con recargo (Step 6)
// Patrón B: llamada directa al service (sin HTTP)
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

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ DB connected\n');

        const TEST_RNC = '130999666';
        const TEST_EMAIL = 'step6-test@expedinap.com';

        await Company.destroy({ where: { rnc: TEST_RNC } });
        await User.destroy({ where: { email: TEST_EMAIL } });

        const registered = await authService.registerCompany(
            {
                company: { rnc: TEST_RNC, name: 'Step6 Test Company SRL' },
                owner: {
                    email: TEST_EMAIL,
                    password: 'TestPass123',
                    firstName: 'Step6',
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

        // Secuencia tipo 32
        await Sequence.create({
            companyId: company.id,
            type: '32',
            prefix: 'E32',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 0,
            isActive: true,
            expiresAt: new Date('2027-12-31')
        });

        console.log('✅ Setup completed\n');

        // ------------------------------------------------------------
        // TEST 1: Joi rechaza tipo 32 con recargo que cruza 250K sin RNC
        // ------------------------------------------------------------
        console.log('--- Test 1: Joi rechaza 32 con recargo que cruza 250K sin RNC ---');
        {
            // qty 1 × 220,000 + recargo 40,000 = 260,000 base
            // itbis 18% = 46,800
            // total = 306,800 >= 250,000
            const { error } = createInvoiceSchema.validate({
                type: '32',
                // sin receiverRnc ni receiverName
                items: [{
                    itemName: 'Producto caro',
                    indicadorBienoServicio: 1,
                    unidadMedida: 43,
                    quantity: 1,
                    unitPrice: 220000,
                    discount: 0,
                    recargo: 40000,
                    itbisRate: 18,
                    indicadorFacturacion: 1
                }]
            }, { abortEarly: false });

            test('Joi rechaza con error', !!error);
            test('mensaje menciona 250,000',
                error?.message?.includes('250,000'));
        }

        // ------------------------------------------------------------
        // TEST 2: Joi acepta mismo caso CON RNC
        // ------------------------------------------------------------
        console.log('\n--- Test 2: Joi acepta 32 con recargo y RNC ---');
        {
            const { error } = createInvoiceSchema.validate({
                type: '32',
                receiverRnc: '130999888',
                receiverName: 'Comprador SRL',
                items: [{
                    itemName: 'Producto caro',
                    indicadorBienoServicio: 1,
                    unidadMedida: 43,
                    quantity: 1,
                    unitPrice: 220000,
                    discount: 0,
                    recargo: 40000,
                    itbisRate: 18,
                    indicadorFacturacion: 1
                }]
            }, { abortEarly: false });

            test('Joi acepta con RNC', !error, error?.message);
        }

        // ------------------------------------------------------------
        // TEST 3: Joi acepta 32 con recargo que NO cruza el umbral (sin RNC)
        // ------------------------------------------------------------
        console.log('\n--- Test 3: Joi acepta 32 con recargo debajo del umbral sin RNC ---');
        {
            // qty 1 × 100,000 + recargo 5,000 = 105,000 base
            // itbis 18% = 18,900
            // total = 123,900 < 250,000
            const { error } = createInvoiceSchema.validate({
                type: '32',
                items: [{
                    itemName: 'Producto barato',
                    indicadorBienoServicio: 1,
                    unidadMedida: 43,
                    quantity: 1,
                    unitPrice: 100000,
                    discount: 0,
                    recargo: 5000,
                    itbisRate: 18,
                    indicadorFacturacion: 1
                }]
            }, { abortEarly: false });

            test('Joi acepta sin RNC (debajo del umbral)', !error, error?.message);
        }

        // ------------------------------------------------------------
        // TEST 4: service create rechaza 32 con recargo >= 250K sin RNC
        // ------------------------------------------------------------
        console.log('\n--- Test 4: service create rechaza 32 con recargo >= 250K sin RNC ---');
        {
            let errorCode = null;
            try {
                await invoicesService.createMyInvoice(
                    company.id,
                    {
                        type: '32',
                        items: [{
                            itemName: 'Producto caro',
                            indicadorBienoServicio: 1,
                            unidadMedida: 43,
                            quantity: 1,
                            unitPrice: 220000,
                            discount: 0,
                            recargo: 40000,
                            itbisRate: 18,
                            indicadorFacturacion: 1
                        }]
                    },
                    owner,
                    { ip: '127.0.0.1', userAgent: 'test' }
                );
            } catch (e) {
                errorCode = e.code || e.message;
            }

            test('service lanza error DGII_250K',
                errorCode === 'DGII_250K_RULE'
                || String(errorCode).includes('250,000'));
        }

        // ------------------------------------------------------------
        // TEST 5: service update rechaza 32 con recargo >= 250K sin RNC
        // ------------------------------------------------------------
        console.log('\n--- Test 5: service update rechaza 32 con recargo >= 250K sin RNC ---');
        {
            // Crear primero un 32 draft válido (sin recargo, debajo del umbral)
            const created = await invoicesService.createMyInvoice(
                company.id,
                {
                    type: '32',
                    items: [{
                        itemName: 'Producto barato',
                        indicadorBienoServicio: 1,
                        unidadMedida: 43,
                        quantity: 1,
                        unitPrice: 100,
                        itbisRate: 18,
                        indicadorFacturacion: 1
                    }]
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const invoiceId = created.invoice.id;

            // Intentar actualizar con recargo que cruza el umbral y sin RNC
            let errorCode = null;
            try {
                await invoicesService.updateMyInvoice(
                    company.id,
                    invoiceId,
                    {
                        items: [{
                            itemName: 'Producto caro actualizado',
                            indicadorBienoServicio: 1,
                            unidadMedida: 43,
                            quantity: 1,
                            unitPrice: 220000,
                            discount: 0,
                            recargo: 40000,
                            itbisRate: 18,
                            indicadorFacturacion: 1
                        }]
                    },
                    owner,
                    { ip: '127.0.0.1', userAgent: 'test' }
                );
            } catch (e) {
                errorCode = e.code || e.message;
            }

            test('service update lanza error DGII_250K',
                errorCode === 'DGII_250K_RNC_REQUIRED'
                || String(errorCode).includes('250,000'));
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            const TEST_RNC = '130999666';
            const TEST_EMAIL = 'step6-test@expedinap.com';
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