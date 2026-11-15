// scripts/excel-to-json.js
//
// Convierte el Excel de pruebas DGII (hojas "ECF" y "RFCE") a JSON.
//
// Uso:
//   node scripts/excel-to-json.js
//
// Requiere que el Excel esté en: scripts/<nombre-del-excel>.xlsx
// (o pasa la ruta como argumento: node scripts/excel-to-json.js ruta/al/excel.xlsx)
//
// Genera:
//   tests/dt30-39/ecf/XX-<Tipo>-<ENCF>.json
//   tests/dt30-39/rfce/XX-<ENCF>.json

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const INPUT_DIR = path.join(__dirname);
const OUTPUT_DIR = path.join(__dirname, '..', 'tests', 'dt30-39');

// Si no se pasa ruta, busca el primer .xlsx en scripts/
function findExcelFile() {
    const argPath = process.argv[2];
    if (argPath) {
        const abs = path.resolve(argPath);
        if (!fs.existsSync(abs)) throw new Error(`No existe el archivo: ${abs}`);
        return abs;
    }

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith('.xlsx'));
    if (files.length === 0) {
        throw new Error(
            `No se encontró ningún .xlsx en ${INPUT_DIR}. ` +
            `Pasa la ruta como argumento: node scripts/excel-to-json.js ruta/al/excel.xlsx`
        );
    }
    if (files.length > 1) {
        console.warn(`⚠️  Hay ${files.length} .xlsx en scripts/. Usando el primero: ${files[0]}`);
    }
    return path.join(INPUT_DIR, files[0]);
}

// ============================================================
// HELPERS: limpieza de valores de Excel
// ============================================================

// Errores de Excel que se tratan como null
const EXCEL_ERRORS = new Set([
    '#e', '#E',
    '#N/A', '#NA',
    '#VALUE!', '#VALUE',
    '#REF!', '#REF',
    '#DIV/0!', '#DIV/0',
    '#NAME?', '#NAME',
    '#NULL!', '#NULL',
    '#NUM!', '#NUM',
    '#GETTING_DATA',
    '#SPILL!', '#CALC!'
]);

/**
 * Limpia un valor de celda de Excel:
 *   - Si es error de Excel (#e, #N/A, etc.) → null
 *   - Si es string vacío o solo espacios → null
 *   - Si es número → number
 *   - Si es fecha (Date) → string ISO
 *   - Resto → string trimmeado
 */
function cleanValue(v) {
    if (v === null || v === undefined) return null;

    if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === '') return null;
        if (EXCEL_ERRORS.has(trimmed)) return null;
        if (EXCEL_ERRORS.has(trimmed.toUpperCase())) return null;
        return trimmed;
    }

    if (typeof v === 'number') {
        if (Number.isNaN(v)) return null;
        return v;
    }

    if (typeof v === 'boolean') return v;

    if (v instanceof Date) {
        // Formato DGII: dd-MM-yyyy
        const day = String(v.getUTCDate()).padStart(2, '0');
        const month = String(v.getUTCMonth() + 1).padStart(2, '0');
        const year = v.getUTCFullYear();
        return `${day}-${month}-${year}`;
    }

    return String(v).trim() || null;
}

// ============================================================
// HELPERS: parseo de nombres de columna
// ============================================================

/**
 * Extrae el "path" de un nombre de columna como:
 *   "FormaPago[1]"        → { base: 'FormaPago', indices: [1] }
 *   "TipoCodigo[3][2]"    → { base: 'TipoCodigo', indices: [3, 2] }
 *   "NumeroLinea"         → { base: 'NumeroLinea', indices: [] }
 */
function parseColumnName(name) {
    const match = String(name).trim().match(/^([^\[]+)((?:\[\d+\])*)$/);
    if (!match) {
        return { base: String(name).trim(), indices: [] };
    }
    const base = match[1].trim();
    const indicesStr = match[2];
    const indices = [];
    const re = /\[(\d+)\]/g;
    let m;
    while ((m = re.exec(indicesStr)) !== null) {
        indices.push(Number(m[1]));
    }
    return { base, indices };
}

// ============================================================
// HELPERS: agrupación de columnas por bloque
// ============================================================

/**
 * Agrupa las columnas de una fila por (base, indices).
 * Devuelve un objeto con dos tipos de campos:
 *   - planos:    { NombreCampo: valor }
 *   - arrays:    { NombreArray: { 1: { subcampo: valor }, 2: { ... } } }
 *
 * Ejemplos:
 *   NumeroLinea[1]  → arrays.items[1].numeroLinea
 *   TipoCodigo[1][1] → arrays.items[1].additionalCodes[1].tipoCodigo
 *   FormaPago[1]    → arrays.formasPago[1].formaPago
 *   NombreCampo     → planos.NombreCampo
 */
function groupColumns(row) {
    const planos = {};
    const arrays = {};

    // Mapeo de "base" a "nombre del array en el JSON resultante"
    const ARRAY_NAME_MAP = {
        // IdDoc
        FormaPago: 'formasPago',
        MontoPago: null, // se agrupa con FormaPago por índice

        // Items (nivel 1 = línea)
        NumeroLinea: 'items',
        TipoCodigo: 'items',      // nivel 2 → additionalCodes
        CodigoItem: 'items',
        IndicadorFacturacion: 'items',
        IndicadorAgenteRetencionoPercepcion: 'items',
        MontoITBISRetenido: 'items',
        MontoISRRetenido: 'items',
        NombreItem: 'items',
        IndicadorBienoServicio: 'items',
        DescripcionItem: 'items',
        CantidadItem: 'items',
        UnidadMedida: 'items',
        CantidadReferencia: 'items',
        UnidadReferencia: 'items',
        Subcantidad: 'items',     // nivel 2 → subcantidades
        CodigoSubcantidad: 'items',
        GradosAlcohol: 'items',
        PrecioUnitarioReferencia: 'items',
        FechaElaboracion: 'items',
        FechaVencimientoItem: 'items',
        PesoNetoKilogramo: 'items',
        PesoNetoMineria: 'items',
        TipoAfiliacion: 'items',
        Liquidacion: 'items',
        PrecioUnitarioItem: 'items',
        DescuentoMonto: 'items',
        TipoSubDescuento: 'items',  // nivel 2 → subDescuentos
        SubDescuentoPorcentaje: 'items',
        MontoSubDescuento: 'items',
        RecargoMonto: 'items',
        TipoSubRecargo: 'items',    // nivel 2 → subRecargos
        SubRecargoPorcentaje: 'items',
        MontosubRecargo: 'items',
        PrecioOtraMoneda: 'items',
        DescuentoOtraMoneda: 'items',
        RecargoOtraMoneda: 'items',
        MontoItemOtraMoneda: 'items',
        MontoItem: 'items',

        // Subtotales
        NumeroSubTotal: 'subtotales',
        DescripcionSubtotal: 'subtotales',
        Orden: 'subtotales',
        SubTotalMontoGravadoTotal: 'subtotales',
        SubTotalMontoGravadoI1: 'subtotales',
        SubTotalMontoGravadoI2: 'subtotales',
        SubTotalMontoGravadoI3: 'subtotales',
        SubTotaITBIS: 'subtotales',
        SubTotaITBIS1: 'subtotales',
        SubTotaITBIS2: 'subtotales',
        SubTotaITBIS3: 'subtotales',
        SubTotalImpuestoAdicional: 'subtotales',
        SubTotalExento: 'subtotales',
        MontoSubTotal: 'subtotales',
        Lineas: 'subtotales',

        // Descuentos/recargos globales
        NumeroLineaDoR: 'descuentosORecargos',
        TipoAjuste: 'descuentosORecargos',
        IndicadorNorma1007: 'descuentosORecargos',
        DescripcionDescuentooRecargo: 'descuentosORecargos',
        TipoValor: 'descuentosORecargos',
        ValorDescuentooRecargo: 'descuentosORecargos',
        MontoDescuentooRecargo: 'descuentosORecargos',
        MontoDescuentooRecargoOtraMoneda: 'descuentosORecargos',
        IndicadorFacturacionDescuentooRecargo: 'descuentosORecargos',

        // Paginación
        PaginaNo: 'paginas',
        NoLineaDesde: 'paginas',
        NoLineaHasta: 'paginas',
        SubtotalMontoGravadoPagina: 'paginas',
        SubtotalMontoGravado1Pagina: 'paginas',
        SubtotalMontoGravado2Pagina: 'paginas',
        SubtotalMontoGravado3Pagina: 'paginas',
        SubtotalExentoPagina: 'paginas',
        SubtotalItbisPagina: 'paginas',
        SubtotalItbis1Pagina: 'paginas',
        SubtotalItbis2Pagina: 'paginas',
        SubtotalItbis3Pagina: 'paginas',
        SubtotalImpuestoAdicionalPagina: 'paginas',
        SubtotalImpuestoSelectivoConsumoEspecificoPagina: 'paginas',
        SubtotalOtrosImpuesto: 'paginas',
        MontoSubtotalPagina: 'paginas',
        SubtotalMontoNoFacturablePagina: 'paginas',

        // Impuestos adicionales del encabezado
        TasaImpuestoAdicional: 'impuestosAdicionales',
        MontoImpuestoSelectivoConsumoEspecifico: 'impuestosAdicionales',
        MontoImpuestoSelectivoConsumoAdvalorem: 'impuestosAdicionales',
        OtrosImpuestosAdicionales: 'impuestosAdicionales',

        // Impuestos adicionales de OtraMoneda
        TipoImpuestoOtraMoneda: 'impuestosAdicionalesOtraMoneda',
        TasaImpuestoAdicionalOtraMoneda: 'impuestosAdicionalesOtraMoneda',
        MontoImpuestoSelectivoConsumoEspecificoOtraMoneda: 'impuestosAdicionalesOtraMoneda',
        MontoImpuestoSelectivoConsumoAdvaloremOtraMoneda: 'impuestosAdicionalesOtraMoneda',
        OtrosImpuestosAdicionalesOtraMoneda: 'impuestosAdicionalesOtraMoneda',
    };

    // Mapeo de "subcampo" para arrays de nivel 2
    // (cuando un campo de item se anida dentro de additionalCodes/subcantidades/etc.)
    const NESTED_ARRAY_MAP = {
        TipoCodigo: 'additionalCodes',
        CodigoItem: 'additionalCodes',
        Subcantidad: 'subcantidades',
        CodigoSubcantidad: 'subcantidades',
        TipoSubDescuento: 'subDescuentos',
        SubDescuentoPorcentaje: 'subDescuentos',
        MontoSubDescuento: 'subDescuentos',
        TipoSubRecargo: 'subRecargos',
        SubRecargoPorcentaje: 'subRecargos',
        MontosubRecargo: 'subRecargos',
        TipoImpuesto: 'impuestosAdicionales', // del encabezado o del item, según nivel
    };

    for (const [colName, rawValue] of Object.entries(row)) {
        const value = cleanValue(rawValue);
        if (value === null) continue; // ignorar vacíos y #e

        const { base, indices } = parseColumnName(colName);

        // Sin índices → campo plano
        if (indices.length === 0) {
            planos[base] = value;
            continue;
        }

        // Con índices → array
        const arrayName = ARRAY_NAME_MAP[base] || base;

        // Caso especial: FormaPago[1] y MontoPago[1] se agrupan en formasPago[1]
        if (base === 'FormaPago' || base === 'MontoPago') {
            const i = indices[0];
            arrays.formasPago = arrays.formasPago || {};
            arrays.formasPago[i] = arrays.formasPago[i] || {};
            if (base === 'FormaPago') arrays.formasPago[i].formaPago = value;
            else arrays.formasPago[i].montoPago = value;
            continue;
        }

        // Arrays de nivel 1 (items, subtotales, descuentos, paginas, etc.)
        if (indices.length === 1) {
            const i = indices[0];
            arrays[arrayName] = arrays[arrayName] || {};
            arrays[arrayName][i] = arrays[arrayName][i] || {};
            // Convertir base a camelCase para el subcampo
            const camel = base.charAt(0).toLowerCase() + base.slice(1);
            arrays[arrayName][i][camel] = value;
            continue;
        }

        // Arrays anidados (nivel 2 dentro de items)
        if (indices.length === 2) {
            const [i, j] = indices;
            arrays[arrayName] = arrays[arrayName] || {};
            arrays[arrayName][i] = arrays[arrayName][i] || {};

            const nestedName = NESTED_ARRAY_MAP[base];
            if (nestedName) {
                arrays[arrayName][i][nestedName] = arrays[arrayName][i][nestedName] || {};
                arrays[arrayName][i][nestedName][j] = arrays[arrayName][i][nestedName][j] || {};
                const camel = base.charAt(0).toLowerCase() + base.slice(1);
                arrays[arrayName][i][nestedName][j][camel] = value;
            } else {
                // Fallback: índice plano
                const camel = base.charAt(0).toLowerCase() + base.slice(1);
                arrays[arrayName][i][camel] = arrays[arrayName][i][camel] || {};
                arrays[arrayName][i][camel][j] = value;
            }
            continue;
        }
    }

    return { planos, arrays };
}

// ============================================================
// HELPERS: convertir arrays indexados a arrays ordenados
// ============================================================

/**
 * Convierte { 1: {a: 1}, 3: {a: 2} } en [{a: 1}, {a: 2}] (ordenado por índice).
 * Ignora los huecos.
 */
function indexedToArray(indexed) {
    if (!indexed) return [];
    const keys = Object.keys(indexed).map(Number).sort((a, b) => a - b);
    return keys.map(k => indexed[k]);
}

/**
 * Convierte un objeto de arrays indexados a un objeto con arrays ordenados.
 * Ej: { items: { 1: {...}, 2: {...} }, subtotales: { 1: {...} } }
 *  → { items: [{...}, {...}], subtotales: [{...}] }
 */
function convertArraysToOrdered(arrays) {
    const result = {};
    for (const [name, indexed] of Object.entries(arrays)) {
        result[name] = indexedToArray(indexed).map(item => {
            // Convertir nested arrays también
            const cleaned = { ...item };
            for (const [k, v] of Object.entries(cleaned)) {
                if (v && typeof v === 'object' && !Array.isArray(v)) {
                    cleaned[k] = indexedToArray(v);
                }
            }
            return cleaned;
        });
    }
    return result;
}

// ============================================================
// PROCESAMIENTO DE UNA HOJA
// ============================================================

function processSheet(sheet, sheetName) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`\n📄 Hoja "${sheetName}": ${rows.length} filas`);

    const result = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const { planos, arrays } = groupColumns(row);
        const arraysOrdered = convertArraysToOrdered(arrays);

        const json = { ...planos, ...arraysOrdered };

        // Agregar metadata
        json._rowNumber = i + 2; // fila en Excel (1 es cabecera)
        json._sheet = sheetName;

        // Normalizar nombres de campos planos a camelCase
        const normalized = {};
        for (const [k, v] of Object.entries(json)) {
            const camel = k.charAt(0).toLowerCase() + k.slice(1);
            normalized[camel] = v;
        }

        result.push(normalized);
    }

    return result;
}

// ============================================================
// MAIN
// ============================================================

function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Excel DGII → JSON');
    console.log('═══════════════════════════════════════════════════');

    const excelPath = findExcelFile();
    console.log(`\n📂 Input: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    console.log(`📑 Hojas encontradas: ${workbook.SheetNames.join(', ')}`);

    // Crear directorios de salida
    const ecfDir = path.join(OUTPUT_DIR, 'ecf');
    const rfceDir = path.join(OUTPUT_DIR, 'rfce');
    fs.mkdirSync(ecfDir, { recursive: true });
    fs.mkdirSync(rfceDir, { recursive: true });

    // ---- Procesar hoja ECF ----
    if (workbook.Sheets['ECF']) {
        const ecfRows = processSheet(workbook.Sheets['ECF'], 'ECF');
        console.log(`\n💾 Guardando ${ecfRows.length} JSON en ${ecfDir}/`);

        for (const row of ecfRows) {
            const ncf = row.eNCF || row.ENCF || row.ncf || `fila-${row._rowNumber}`;
            const tipo = row.tipoeCF || row.TipoeCF || 'XX';
            const num = String(row._rowNumber - 1).padStart(2, '0');
            const safeNcf = String(ncf).replace(/[^A-Za-z0-9]/g, '');
            const filename = `${num}-${tipo}-${safeNcf}.json`;
            const filepath = path.join(ecfDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(row, null, 2));
            console.log(`  ✅ ${filename}`);
        }
    } else {
        console.log('⚠️  No se encontró la hoja "ECF"');
    }

    // ---- Procesar hoja RFCE ----
    if (workbook.Sheets['RFCE']) {
        const rfceRows = processSheet(workbook.Sheets['RFCE'], 'RFCE');
        console.log(`\n💾 Guardando ${rfceRows.length} JSON en ${rfceDir}/`);

        for (const row of rfceRows) {
            const ncf = row.eNCF || row.ENCF || row.ncf || `fila-${row._rowNumber}`;
            const num = String(row._rowNumber - 1).padStart(2, '0');
            const safeNcf = String(ncf).replace(/[^A-Za-z0-9]/g, '');
            const filename = `${num}-${safeNcf}.json`;
            const filepath = path.join(rfceDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(row, null, 2));
            console.log(`  ✅ ${filename}`);
        }
    } else {
        console.log('⚠️  No se encontró la hoja "RFCE"');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ Conversión completada');
    console.log('═══════════════════════════════════════════════════\n');
}

main();