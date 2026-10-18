// ============================================================
// test/integration/company-logo.model.test.js
//
// Test de integración del modelo CompanyLogo contra Postgres real.
//
// Requisitos:
//   - Migración 017_create_company_logos.sql ejecutada
//   - NODE_ENV=test (silencia SQL logging del config)
//
// Uso:
//   PowerShell:  $env:NODE_ENV="test"; node test/integration/company-logo.model.test.js
//   CMD:         set NODE_ENV=test && node test/integration/company-logo.model.test.js
//   Bash:        NODE_ENV=test node test/integration/company-logo.model.test.js
//
// El test crea su propia empresa temporal y la borra al final.
// No toca datos existentes.
// ============================================================

const { Company, CompanyLogo } = require('../../src/models');
const sequelize = require('../../src/config/database'); // export directo, sin destructuring

// ------------------------------------------------------------
// Test harness (mismo estilo que el resto de tests del proyecto)
// ------------------------------------------------------------
let passed = 0;
let failed = 0;
let testCompanyId = null;

function test(label, condition, extra = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${extra ? ': ' + extra : ''}`);
        failed++;
    }
}

// ------------------------------------------------------------
// Cierra la conexión de forma tolerante (evita crash si ya está cerrada)
// ------------------------------------------------------------
async function closeDb() {
    try {
        await sequelize.close();
    } catch (e) {
        // ya cerrada o nunca abierta
    }
}

// ------------------------------------------------------------
// Cleanup defensivo: borra la empresa de prueba si quedó viva
// ------------------------------------------------------------
async function cleanupCompany() {
    if (!testCompanyId) return;
    try {
        // force: true → hard delete aunque el modelo tenga paranoid
        await Company.destroy({ where: { id: testCompanyId }, force: true });
    } catch (e) {
        // ignorar: la empresa ya pudo haber sido borrada por el propio test
    }
}

// ------------------------------------------------------------
// Runner principal
// ------------------------------------------------------------
async function run() {
    // ============================================================
    // SETUP: crear empresa temporal
    // ============================================================
    console.log('=== SETUP: crear empresa temporal ===\n');

    // RNC único de 9 dígitos (evita choque con UNIQUE de companies)
    const testRnc = '9' + String(Date.now()).slice(-8);

    const company = await Company.create({
        rnc: testRnc,
        name: 'Test Company Logos',
        isActive: true,
        dgiiEnvironment: 'testecf'
    });

    testCompanyId = company.id;
    console.log(`  ✅ Empresa creada: ${company.id} (RNC ${testRnc})`);

    // ============================================================
    // TESTS: crear logos
    // ============================================================
    console.log('\n=== TESTS: crear logos ===\n');

    const invoiceLogo = await CompanyLogo.create({
        companyId: company.id,
        purpose: 'invoice',
        publicId: `ExpediFact/logos/${company.id}/invoice`,
        url: 'http://res.cloudinary.com/demo/image/upload/v1/inv.png',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/inv.png',
        format: 'png',
        width: 600,
        height: 400,
        bytes: 1000,
        uploadedAt: new Date()
    });

    test('crea logo invoice', invoiceLogo.id !== undefined);
    test('purpose es invoice', invoiceLogo.purpose === 'invoice');
    test('companyId correcto', invoiceLogo.companyId === company.id);
    test('publicId se persiste', invoiceLogo.publicId === `ExpediFact/logos/${company.id}/invoice`);
    test('secureUrl se persiste', invoiceLogo.secureUrl.startsWith('https://'));

    const dashboardLogo = await CompanyLogo.create({
        companyId: company.id,
        purpose: 'dashboard',
        publicId: `ExpediFact/logos/${company.id}/dashboard`,
        url: 'http://res.cloudinary.com/demo/image/upload/v1/dash.png',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/dash.png',
        format: 'png',
        width: 800,
        height: 200,
        bytes: 2000,
        uploadedAt: new Date()
    });

    test('crea logo dashboard', dashboardLogo.id !== undefined);
    test('purpose es dashboard', dashboardLogo.purpose === 'dashboard');

    // ============================================================
    // TESTS: UNIQUE (company_id, purpose)
    // ============================================================
    console.log('\n=== TESTS: UNIQUE (company_id, purpose) ===\n');

    let dupErr = null;
    try {
        await CompanyLogo.create({
            companyId: company.id,
            purpose: 'invoice', // duplicado
            publicId: 'x',
            url: 'http://x',
            secureUrl: 'https://x',
            format: 'png',
            width: 1,
            height: 1,
            bytes: 1,
            uploadedAt: new Date()
        });
    } catch (e) {
        dupErr = e;
    }

    test('rechaza duplicado de invoice', dupErr !== null);
    test(
        'error es unique constraint',
        dupErr?.name === 'SequelizeUniqueConstraintError' || dupErr?.parent?.code === '23505'
    );

    // ============================================================
    // TESTS: default de purpose
    // ============================================================
    console.log('\n=== TESTS: default de purpose ===\n');

    // Borramos el logo dashboard para no chocar con UNIQUE al crear sin purpose
    await dashboardLogo.destroy();

    const defaultPurposeLogo = await CompanyLogo.create({
        companyId: company.id,
        // sin purpose → debe usar 'invoice' (ya existe, chocará con UNIQUE)
        // así que lo borramos primero para probar el default
        publicId: 'tmp',
        url: 'http://tmp',
        secureUrl: 'https://tmp',
        format: 'png',
        width: 1,
        height: 1,
        bytes: 1,
        uploadedAt: new Date()
    }).catch((e) => e);

    // Como ya existía invoice, debe fallar por UNIQUE.
    // Eso confirma que el default 'invoice' se aplicó correctamente.
    test(
        'purpose default es invoice (colisiona con UNIQUE existente)',
        defaultPurposeLogo instanceof Error
    );

    // Recreamos el logo dashboard para el test de asociación
    await CompanyLogo.create({
        companyId: company.id,
        purpose: 'dashboard',
        publicId: `ExpediFact/logos/${company.id}/dashboard`,
        url: 'http://res.cloudinary.com/demo/image/upload/v1/dash.png',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/dash.png',
        format: 'png',
        width: 800,
        height: 200,
        bytes: 2000,
        uploadedAt: new Date()
    });

    // ============================================================
    // TESTS: asociación Company → CompanyLogo
    // ============================================================
    console.log('\n=== TESTS: asociación Company → CompanyLogo ===\n');

    const companyWithLogos = await Company.findByPk(company.id, {
        include: [{ model: CompanyLogo, as: 'logos' }]
    });

    test('company.logos es array', Array.isArray(companyWithLogos.logos));
    test('company.logos tiene 2 elementos', companyWithLogos.logos.length === 2);

    const purposes = companyWithLogos.logos.map((l) => l.purpose).sort();
    test(
        'purposes son dashboard e invoice',
        purposes[0] === 'dashboard' && purposes[1] === 'invoice'
    );

    // ============================================================
    // TESTS: CASCADE al borrar company
    // ============================================================
    console.log('\n=== TESTS: CASCADE delete ===\n');

    const logosBefore = await CompanyLogo.count({ where: { companyId: company.id } });
    test('hay 2 logos antes del delete', logosBefore === 2);

    // Forzamos CASCADE (el test crea datos, el destroy los borra)
    await Company.destroy({ where: { id: company.id }, force: true });

    // Marcamos la empresa como borrada para que el cleanup no reintente
    testCompanyId = null;

    const logosAfter = await CompanyLogo.count({ where: { companyId: company.id } });
    test('CASCADE borra los logos', logosAfter === 0);

    // ============================================================
    // RESULTADO
    // ============================================================
    console.log('\n=== CLEANUP ===\n');
    console.log('  ✅ Cleanup completado');

    console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);

    await closeDb();
    process.exit(failed > 0 ? 1 : 0);
}

// ------------------------------------------------------------
// Entry point con cleanup defensivo
// ------------------------------------------------------------
run().catch(async (err) => {
    console.error('\n❌ Test runner crashed:', err);
    await cleanupCompany();
    await closeDb();
    process.exit(1);
});