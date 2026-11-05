// ============================================================
// Tabla I — Codificación de Tipos de Impuestos Adicionales (DGII v1.0)
// Fuente: PDF "Formato Comprobante Fiscal Electrónico" — Tabla I
//
// Agrupación por categoría:
//   001-005: Otros Impuestos Adicionales
//   006-018: ISC Específico — bebidas alcohólicas
//   019-022: ISC Específico — tabaco
//   023-035: ISC Ad Valorem — bebidas alcohólicas
//   036-039: ISC Ad Valorem — tabaco
// ============================================================

const ADDITIONAL_TAXES = {
    '001': { code: '001', name: 'Propina Legal', shortName: 'Propina', category: 'otros', rate: 10.00, rateType: 'percentage' },
    '002': { code: '002', name: 'Contribución al Desarrollo de las Telecomunicaciones', shortName: 'CDT', category: 'otros', rate: 2.00, rateType: 'percentage' },
    '003': { code: '003', name: 'ISC — Servicios de Seguros en General', shortName: 'ISC Seguros', category: 'otros', rate: 16.00, rateType: 'percentage' },
    '004': { code: '004', name: 'ISC — Servicios de Telecomunicaciones', shortName: 'ISC Telecom', category: 'otros', rate: 10.00, rateType: 'percentage' },
    '005': { code: '005', name: 'Primer Registro de Vehículos (Primera Placa)', shortName: 'Primera Placa', category: 'otros', rate: 17.00, rateType: 'percentage' },

    '006': { code: '006', name: 'ISC Específico — Cerveza', shortName: 'Cerveza', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '007': { code: '007', name: 'ISC Específico — Vinos de Uva', shortName: 'Vinos', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '008': { code: '008', name: 'ISC Específico — Vermut y Demás Vinos de Uvas Frescas', shortName: 'Vermut', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '009': { code: '009', name: 'ISC Específico — Demás Bebidas Fermentadas', shortName: 'Bebidas Fermentadas', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '010': { code: '010', name: 'ISC Específico — Alcohol Etílico sin Desnaturalizar (≥ 80%)', shortName: 'Alcohol ≥80%', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '011': { code: '011', name: 'ISC Específico — Alcohol Etílico sin Desnaturalizar (< 80%)', shortName: 'Alcohol <80%', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '012': { code: '012', name: 'ISC Específico — Aguardientes de Uva', shortName: 'Aguardientes Uva', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '013': { code: '013', name: 'ISC Específico — Whisky', shortName: 'Whisky', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '014': { code: '014', name: 'ISC Específico — Ron y Demás Aguardientes de Caña', shortName: 'Ron', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '015': { code: '015', name: 'ISC Específico — Gin y Ginebra', shortName: 'Gin', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '016': { code: '016', name: 'ISC Específico — Vodka', shortName: 'Vodka', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '017': { code: '017', name: 'ISC Específico — Licores', shortName: 'Licores', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '018': { code: '018', name: 'ISC Específico — Los Demás (Bebidas y Alcoholes)', shortName: 'Otros Alcoholes', category: 'isc_especifico', rate: 632.58, rateType: 'specific' },
    '019': { code: '019', name: 'ISC Específico — Cigarrillos 20 Unidades', shortName: 'Cigarrillos 20u', category: 'isc_especifico', rate: 53.51, rateType: 'specific' },
    '020': { code: '020', name: 'ISC Específico — Demás Cigarrillos 20 Unidades', shortName: 'Otros Cigarrillos 20u', category: 'isc_especifico', rate: 53.51, rateType: 'specific' },
    '021': { code: '021', name: 'ISC Específico — Cigarrillos 10 Unidades', shortName: 'Cigarrillos 10u', category: 'isc_especifico', rate: 26.75, rateType: 'specific' },
    '022': { code: '022', name: 'ISC Específico — Demás Cigarrillos 10 Unidades', shortName: 'Otros Cigarrillos 10u', category: 'isc_especifico', rate: 26.75, rateType: 'specific' },

    '023': { code: '023', name: 'ISC Ad Valorem — Cerveza', shortName: 'Cerveza', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '024': { code: '024', name: 'ISC Ad Valorem — Vinos de Uva', shortName: 'Vinos', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '025': { code: '025', name: 'ISC Ad Valorem — Vermut y Demás Vinos de Uvas Frescas', shortName: 'Vermut', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '026': { code: '026', name: 'ISC Ad Valorem — Demás Bebidas Fermentadas', shortName: 'Bebidas Fermentadas', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '027': { code: '027', name: 'ISC Ad Valorem — Alcohol Etílico sin Desnaturalizar (≥ 80%)', shortName: 'Alcohol ≥80%', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '028': { code: '028', name: 'ISC Ad Valorem — Alcohol Etílico sin Desnaturalizar (< 80%)', shortName: 'Alcohol <80%', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '029': { code: '029', name: 'ISC Ad Valorem — Aguardientes de Uva', shortName: 'Aguardientes Uva', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '030': { code: '030', name: 'ISC Ad Valorem — Whisky', shortName: 'Whisky', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '031': { code: '031', name: 'ISC Ad Valorem — Ron y Demás Aguardientes de Caña', shortName: 'Ron', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '032': { code: '032', name: 'ISC Ad Valorem — Gin y Ginebra', shortName: 'Gin', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '033': { code: '033', name: 'ISC Ad Valorem — Vodka', shortName: 'Vodka', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '034': { code: '034', name: 'ISC Ad Valorem — Licores', shortName: 'Licores', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '035': { code: '035', name: 'ISC Ad Valorem — Los Demás (Bebidas y Alcoholes)', shortName: 'Otros Alcoholes', category: 'isc_advalorem', rate: 10.00, rateType: 'percentage' },
    '036': { code: '036', name: 'ISC Ad Valorem — Cigarrillos 20 Unidades', shortName: 'Cigarrillos 20u', category: 'isc_advalorem', rate: 20.00, rateType: 'percentage' },
    '037': { code: '037', name: 'ISC Ad Valorem — Demás Cigarrillos 20 Unidades', shortName: 'Otros Cigarrillos 20u', category: 'isc_advalorem', rate: 20.00, rateType: 'percentage' },
    '038': { code: '038', name: 'ISC Ad Valorem — Cigarrillos 10 Unidades', shortName: 'Cigarrillos 10u', category: 'isc_advalorem', rate: 20.00, rateType: 'percentage' },
    '039': { code: '039', name: 'ISC Ad Valorem — Demás Cigarrillos 10 Unidades', shortName: 'Otros Cigarrillos 10u', category: 'isc_advalorem', rate: 20.00, rateType: 'percentage' }
};

const VALID_ADDITIONAL_TAX_CODES = Object.keys(ADDITIONAL_TAXES);

const ADDITIONAL_TAX_CATEGORIES = {
    otros: ['001', '002', '003', '004', '005'],
    isc_especifico_alcohol: ['006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018'],
    isc_especifico_tabaco: ['019', '020', '021', '022'],
    isc_advalorem_alcohol: ['023', '024', '025', '026', '027', '028', '029', '030', '031', '032', '033', '034', '035'],
    isc_advalorem_tabaco: ['036', '037', '038', '039']
};

const isOtroImpuesto = (code) => ADDITIONAL_TAX_CATEGORIES.otros.includes(String(code));
const isIscEspecifico = (code) =>
    ADDITIONAL_TAX_CATEGORIES.isc_especifico_alcohol.includes(String(code)) ||
    ADDITIONAL_TAX_CATEGORIES.isc_especifico_tabaco.includes(String(code));
const isIscAdvalorem = (code) =>
    ADDITIONAL_TAX_CATEGORIES.isc_advalorem_alcohol.includes(String(code)) ||
    ADDITIONAL_TAX_CATEGORIES.isc_advalorem_tabaco.includes(String(code));

module.exports = {
    ADDITIONAL_TAXES,
    VALID_ADDITIONAL_TAX_CODES,
    ADDITIONAL_TAX_CATEGORIES,
    isOtroImpuesto,
    isIscEspecifico,
    isIscAdvalorem
};