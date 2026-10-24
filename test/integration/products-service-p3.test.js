// ============================================================
// Test integración: products.service (Step P3)
// Patrón B: llamada directa al service (sin HTTP)
// Requiere: Postgres corriendo + DATABASE_URL en .env
// ============================================================

require('dotenv').config();
const sequelize = require('../../src/config/database');
const {
    User,
    Company,
    Product,
    Subscription,
    AuditLog
} = require('../../src/models');

const productsService = require('../../src/modules/pos/products/products.service');
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

        const TEST_RNC = '130999444';
        const TEST_EMAIL = 'step-p3-products@expedinap.com';

        await Company.destroy({ where: { rnc: TEST_RNC } });
        await User.destroy({ where: { email: TEST_EMAIL } });

        const registered = await authService.registerCompany(
            {
                company: { rnc: TEST_RNC, name: 'P3 Test Company SRL' },
                owner: {
                    email: TEST_EMAIL,
                    password: 'TestPass123',
                    firstName: 'P3',
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

        console.log('✅ Setup completed\n');

        // ============================================================
        // TEST 1: crear BIEN con unidadMedida
        // ============================================================
        console.log('--- Test 1: crear Bien ---');
        let bienId;
        {
            const { product } = await productsService.createMyProduct(
                company.id,
                {
                    name: 'Laptop HP',
                    price: 25000,
                    taxType: 'ITBIS_18',
                    indicadorBienoServicio: 1,
                    unidadMedida: 43
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );
            bienId = product.id;

            test('indicadorBienoServicio = 1', product.indicadorBienoServicio === 1);
            test('unidadMedida = 43', product.unidadMedida === 43);
            test('gradosAlcohol = null', product.gradosAlcohol === null);
        }

        // ============================================================
        // TEST 2: crear SERVICIO sin unidadMedida
        // ============================================================
        console.log('\n--- Test 2: crear Servicio ---');
        let servicioId;
        {
            const { product } = await productsService.createMyProduct(
                company.id,
                {
                    name: 'Consultoría DGII',
                    price: 1500,
                    taxType: 'ITBIS_18',
                    indicadorBienoServicio: 2
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );
            servicioId = product.id;

            test('indicadorBienoServicio = 2', product.indicadorBienoServicio === 2);
            test('unidadMedida = null', product.unidadMedida === null);
        }

        // ============================================================
        // TEST 3: crear LICOR con todos los campos DGII
        // ============================================================
        console.log('\n--- Test 3: crear Licor completo ---');
        {
            const { product } = await productsService.createMyProduct(
                company.id,
                {
                    name: 'Whisky Old Parr 750ml',
                    description: 'Botella 750ml, edición especial',
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
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            test('gradosAlcohol = 40', Number(product.gradosAlcohol) === 40);
            test('cantidadReferencia = 750', Number(product.cantidadReferencia) === 750);
            test('unidadReferencia = 59', product.unidadReferencia === 59);
            test('precioUnitarioReferencia = 2700',
                Number(product.precioUnitarioReferencia) === 2700);
            test('fechaElaboracion presente', !!product.fechaElaboracion);
            test('fechaVencimientoItem presente', !!product.fechaVencimientoItem);
        }

        // ============================================================
        // TEST 4: update parcial sin cambiar coherencia
        // ============================================================
        console.log('\n--- Test 4: update parcial (solo precio) ---');
        {
            const { product } = await productsService.updateMyProduct(
                company.id,
                bienId,
                { price: 30000 },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            test('precio actualizado', Number(product.price) === 30000);
            test('indicadorBienoServicio sigue 1', product.indicadorBienoServicio === 1);
            test('unidadMedida sigue 43', product.unidadMedida === 43);
        }

        // ============================================================
        // TEST 5: update Bien → Servicio (unidad previa queda, es válido)
        // ============================================================
        console.log('\n--- Test 5: update Bien→Servicio (unidad preservada) ---');
        {
            const { product } = await productsService.updateMyProduct(
                company.id,
                bienId,
                { indicadorBienoServicio: 2 },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            test('cambió a servicio', product.indicadorBienoServicio === 2);
            test('unidadMedida preservada (43)', product.unidadMedida === 43);
        }

        // ============================================================
        // TEST 6: update Servicio → Bien con unidad previa en BD → OK
        // ============================================================
        console.log('\n--- Test 6: update Servicio→Bien con unidad previa ---');
        {
            const { product } = await productsService.updateMyProduct(
                company.id,
                bienId,
                { indicadorBienoServicio: 1 },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            test('volvió a bien', product.indicadorBienoServicio === 1);
            test('unidadMedida preservada (43)', product.unidadMedida === 43);
        }

        // ============================================================
        // TEST 7: update Servicio → Bien SIN unidad previa → error 409
        // ============================================================
        console.log('\n--- Test 7: update Servicio→Bien sin unidad previa → error ---');
        {
            let errorCode = null;
            try {
                await productsService.updateMyProduct(
                    company.id,
                    servicioId,
                    { indicadorBienoServicio: 1 },
                    owner,
                    { ip: '127.0.0.1', userAgent: 'test' }
                );
            } catch (e) {
                errorCode = e.code;
            }

            test('rechaza cambio sin unidadMedida',
                errorCode === 'UNIDAD_MEDIDA_REQUIRED',
                `errorCode: ${errorCode}`);
        }

        // ============================================================
        // TEST 8: update agrega gradosAlcohol a un servicio → error 409
        // ============================================================
        console.log('\n--- Test 8: update gradosAlcohol a servicio → error ---');
        {
            let errorCode = null;
            try {
                await productsService.updateMyProduct(
                    company.id,
                    servicioId,
                    { gradosAlcohol: 40 },
                    owner,
                    { ip: '127.0.0.1', userAgent: 'test' }
                );
            } catch (e) {
                errorCode = e.code;
            }

            test('rechaza gradosAlcohol en servicio',
                errorCode === 'GRADOS_ALCOHOL_NOT_ALLOWED',
                `errorCode: ${errorCode}`);
        }

        // ============================================================
        // TEST 9: listMyProducts con filtro indicadorBienoServicio
        // ============================================================
        console.log('\n--- Test 9: listMyProducts con filtro ---');
        {
            const bienes = await productsService.listMyProducts(
                company.id,
                { indicadorBienoServicio: 1 }
            );
            const servicios = await productsService.listMyProducts(
                company.id,
                { indicadorBienoServicio: 2 }
            );

            test('filtra bienes correctamente',
                bienes.items.every(p => p.indicadorBienoServicio === 1));
            test('filtra servicios correctamente',
                servicios.items.every(p => p.indicadorBienoServicio === 2));
            test('al menos 1 bien', bienes.items.length >= 1);
            test('al menos 1 servicio', servicios.items.length >= 1);
        }

        // ============================================================
        // TEST 10: delete de producto sin facturas → OK
        // ============================================================
        console.log('\n--- Test 10: delete sin facturas ---');
        {
            // Creamos un producto nuevo para borrarlo sin miedo
            const { product: temp } = await productsService.createMyProduct(
                company.id,
                {
                    name: 'Producto temporal',
                    price: 100,
                    taxType: 'EXENTO',
                    indicadorBienoServicio: 1,
                    unidadMedida: 43
                },
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            const result = await productsService.deleteMyProduct(
                company.id,
                temp.id,
                owner,
                { ip: '127.0.0.1', userAgent: 'test' }
            );

            test('delete exitoso', result.deleted === true);
            test('before.nombre correcto', result.before.name === 'Producto temporal');

            // Confirmar que ya no existe
            const still = await Product.findByPk(temp.id);
            test('producto eliminado de BD', still === null);
        }

    } catch (error) {
        console.error('❌ Test error:', error.message);
        console.error(error.stack);
        failed++;
    } finally {
        try {
            const TEST_RNC = '130999444';
            const TEST_EMAIL = 'step-p3-products@expedinap.com';
            const company = await Company.findOne({ where: { rnc: TEST_RNC } });
            if (company) {
                const users = await User.findAll({ where: { companyId: company.id } });
                for (const u of users) {
                    await AuditLog.destroy({ where: { userId: u.id } });
                }
                await Product.destroy({ where: { companyId: company.id } });
                await AuditLog.destroy({ where: { companyId: company.id } });
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