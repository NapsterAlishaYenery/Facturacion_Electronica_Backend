// ============================================================
// Test unitario: Product model
// Mockea config/database para no tocar la BD real.
// Verifica atributos, mappings (underscored), validadores e índices.
// ============================================================

const { DataTypes } = require('sequelize');

// ------------------------------------------------------------
// Helper de test
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Mock de config/database (mismo patrón que company-logo.model.test.js)
// ------------------------------------------------------------
const path = require('path');

const dbPath = require.resolve('../../src/config/database');

const mockSequelize = {
    define: (modelName, attributes, options) => {
        return {
            _modelName: modelName,
            _attributes: attributes,
            _options: options,
            rawAttributes: attributes
        };
    }
};

require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: mockSequelize
};

// Ahora sí cargar el modelo (usará el mock)
const Product = require('../../src/models/product.model');

// ============================================================
// TESTS
// ============================================================
console.log('=== TESTS: Product model ===\n');

// ------------------------------------------------------------
// 1. Metadatos básicos
// ------------------------------------------------------------
console.log('--- Metadatos ---');
test('modelName = Product', Product._modelName === 'Product');
test('tableName = products', Product._options.tableName === 'products');
test('timestamps = true', Product._options.timestamps === true);
test('underscored = true', Product._options.underscored === true);
test('createdAt mapped a created_at', Product._options.createdAt === 'created_at');
test('updatedAt mapped a updated_at', Product._options.updatedAt === 'updated_at');

// ------------------------------------------------------------
// 2. Atributos: id
// ------------------------------------------------------------
console.log('\n--- Atributo: id ---');
const idAttr = Product._attributes.id;
test('id existe', !!idAttr);
test('id es UUID', idAttr.type.key === DataTypes.UUID.key);
test('id es primaryKey', idAttr.primaryKey === true);
test('id tiene defaultValue UUIDV4',
    idAttr.defaultValue === DataTypes.UUIDV4);

// ------------------------------------------------------------
// 3. Atributos: companyId
// ------------------------------------------------------------
console.log('\n--- Atributo: companyId ---');
const companyIdAttr = Product._attributes.companyId;
test('companyId existe', !!companyIdAttr);
test('companyId es UUID', companyIdAttr.type.key === DataTypes.UUID.key);
test('companyId allowNull = false', companyIdAttr.allowNull === false);
test('companyId mapea a company_id', companyIdAttr.field === 'company_id');

// ------------------------------------------------------------
// 4. Atributos: name
// ------------------------------------------------------------
console.log('\n--- Atributo: name ---');
const nameAttr = Product._attributes.name;
test('name existe', !!nameAttr);
test('name es STRING(200)',
    nameAttr.type.key === DataTypes.STRING.key &&
    nameAttr.type.options.length === 200);
test('name allowNull = false', nameAttr.allowNull === false);
test('name tiene validador notEmpty', !!nameAttr.validate.notEmpty);
test('name tiene validador len', Array.isArray(nameAttr.validate.len.args));
test('name len args [2,200]',
    nameAttr.validate.len.args[0] === 2 &&
    nameAttr.validate.len.args[1] === 200);

// ------------------------------------------------------------
// 5. Atributos: description
// ------------------------------------------------------------
console.log('\n--- Atributo: description ---');
const descAttr = Product._attributes.description;
test('description existe', !!descAttr);
test('description es TEXT', descAttr.type.key === DataTypes.TEXT.key);
test('description allowNull = true', descAttr.allowNull === true);

// ------------------------------------------------------------
// 6. Atributos: price
// ------------------------------------------------------------
console.log('\n--- Atributo: price ---');
const priceAttr = Product._attributes.price;
test('price existe', !!priceAttr);
test('price es DECIMAL(12,2)',
    priceAttr.type.key === DataTypes.DECIMAL.key &&
    priceAttr.type.options.precision === 12 &&
    priceAttr.type.options.scale === 2);
test('price allowNull = false', priceAttr.allowNull === false);
test('price tiene validador min', Array.isArray(priceAttr.validate.min.args));
test('price min = 0', priceAttr.validate.min.args[0] === 0);
test('price tiene validador isDecimal', !!priceAttr.validate.isDecimal);

// ------------------------------------------------------------
// 7. Atributos: taxType
// ------------------------------------------------------------
console.log('\n--- Atributo: taxType ---');
const taxAttr = Product._attributes.taxType;
test('taxType existe', !!taxAttr);
test('taxType es STRING(20)',
    taxAttr.type.key === DataTypes.STRING.key &&
    taxAttr.type.options.length === 20);
test('taxType allowNull = false', taxAttr.allowNull === false);
test('taxType mapea a tax_type', taxAttr.field === 'tax_type');
test('taxType tiene validador isIn', Array.isArray(taxAttr.validate.isIn.args[0]));
test('taxType valores permitidos = 4',
    taxAttr.validate.isIn.args[0].length === 4);
test('taxType incluye ITBIS_18',
    taxAttr.validate.isIn.args[0].includes('ITBIS_18'));
test('taxType incluye ITBIS_16',
    taxAttr.validate.isIn.args[0].includes('ITBIS_16'));
test('taxType incluye EXENTO',
    taxAttr.validate.isIn.args[0].includes('EXENTO'));
test('taxType incluye ITBIS_3_46',
    taxAttr.validate.isIn.args[0].includes('ITBIS_3_46'));

// ------------------------------------------------------------
// 8. Atributos: itemCode
// ------------------------------------------------------------
console.log('\n--- Atributo: itemCode ---');
const codeAttr = Product._attributes.itemCode;
test('itemCode existe', !!codeAttr);
test('itemCode es STRING(50)',
    codeAttr.type.key === DataTypes.STRING.key &&
    codeAttr.type.options.length === 50);
test('itemCode allowNull = true', codeAttr.allowNull === true);
test('itemCode mapea a item_code', codeAttr.field === 'item_code');

// ------------------------------------------------------------
// 9. Atributos: isActive
// ------------------------------------------------------------
console.log('\n--- Atributo: isActive ---');
const activeAttr = Product._attributes.isActive;
test('isActive existe', !!activeAttr);
test('isActive es BOOLEAN',
    activeAttr.type.key === DataTypes.BOOLEAN.key);
test('isActive allowNull = false', activeAttr.allowNull === false);
test('isActive defaultValue = true', activeAttr.defaultValue === true);
test('isActive mapea a is_active', activeAttr.field === 'is_active');

// ------------------------------------------------------------
// 10. Índices
// ------------------------------------------------------------
console.log('\n--- Índices ---');
const indexes = Product._options.indexes || [];
test('hay 3 índices declarados', indexes.length === 3);

const hasCompanyIdx = indexes.some(i =>
    i.fields.length === 1 && i.fields[0] === 'company_id'
);
test('índice en company_id', hasCompanyIdx);

const hasActiveIdx = indexes.some(i =>
    i.fields.length === 1 && i.fields[0] === 'is_active'
);
test('índice en is_active', hasActiveIdx);

const hasCompositeIdx = indexes.some(i =>
    i.fields.length === 2 &&
    i.fields[0] === 'company_id' &&
    i.fields[1] === 'is_active'
);
test('índice compuesto (company_id, is_active)', hasCompositeIdx);

// ============================================================
// RESULTADO
// ============================================================
console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);