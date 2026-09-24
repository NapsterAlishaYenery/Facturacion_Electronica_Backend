require('dotenv').config();
const sequelize = require('../src/config/database');
const {
    Company,
    Plan,
    Subscription,
    SubscriptionPayment,
    User,
    Sequence,
    Invoice,
    InvoiceLine,
    AuditLog
} = require('../src/models'); // ← Importa el index.js, no los modelos individuales

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection OK');

        // 1. Setup completo
        const company = await Company.create({
            rnc: '130999444',
            name: 'Association Test Company'
        });

        const plan = await Plan.findOne({ where: { code: 'basic' } });

        const subscription = await Subscription.create({
            companyId: company.id,
            planId: plan.id,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        const sequence = await Sequence.create({
            companyId: company.id,
            type: '32',
            startNumber: 1,
            endNumber: 100,
            currentNumber: 1,
            expiresAt: new Date('2026-12-31')
        });

        const invoice = await Invoice.create({
            companyId: company.id,
            sequenceId: sequence.id,
            type: '32',
            ncf: 'E320000000001',
            status: 'draft',
            issuerRnc: company.rnc,
            issuerName: company.name,
            subtotal: 100,
            itbis: 18,
            total: 118,
            issuedAt: new Date()
        });

        await InvoiceLine.bulkCreate([
            { invoiceId: invoice.id, lineNumber: 1, description: 'Item 1', quantity: 1, unitPrice: 100, itbisRate: 18, itbisAmount: 18, total: 118 }
        ]);

        console.log('✅ Setup complete');

        // 2. Probar include: Invoice → Lines
        const invoiceWithLines = await Invoice.findByPk(invoice.id, {
            include: [{ model: InvoiceLine, as: 'lines' }]
        });
        console.log('\n📋 Invoice → Lines:');
        console.log('   NCF:', invoiceWithLines.ncf);
        console.log('   Lines:', invoiceWithLines.lines.length);
        invoiceWithLines.lines.forEach(l => {
            console.log(`   ${l.lineNumber}. ${l.description} = ${l.total}`);
        });

        // 3. Probar include: Company → Subscriptions
        const companyWithSubs = await Company.findByPk(company.id, {
            include: [{ model: Subscription, as: 'subscriptions' }]
        });
        console.log('\n📋 Company → Subscriptions:');
        console.log('   Company:', companyWithSubs.name);
        console.log('   Subscriptions:', companyWithSubs.subscriptions.length);

        // 4. Probar include anidado: Company → Invoices → Lines
        const companyFull = await Company.findByPk(company.id, {
            include: [{
                model: Invoice,
                as: 'invoices',
                include: [{ model: InvoiceLine, as: 'lines' }]
            }]
        });
        console.log('\n📋 Company → Invoices → Lines:');
        console.log('   Company:', companyFull.name);
        console.log('   Invoices:', companyFull.invoices.length);
        companyFull.invoices.forEach(inv => {
            console.log(`   - NCF ${inv.ncf}: ${inv.lines.length} lines`);
        });

        // 5. Probar include: Invoice → Company
        const invoiceWithCompany = await Invoice.findByPk(invoice.id, {
            include: [{ model: Company, as: 'company' }]
        });
        console.log('\n📋 Invoice → Company:');
        console.log('   NCF:', invoiceWithCompany.ncf);
        console.log('   Company:', invoiceWithCompany.company.name);

        // 6. Limpiar
        await invoice.destroy(); // CASCADE borra lines
        await sequence.destroy();
        await subscription.destroy();
        await company.destroy();
        console.log('\n🧹 Cleaned up');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();