module.exports = {
    TIPOS_ECF: ['31', '32', '33', '34', '41', '43', '44', '45', '46', '47'],

    EXPECTED_RATES: {
        0: 0,    // No Facturable
        1: 18,   // ITBIS 18%
        2: 16,   // ITBIS 16%
        3: 0,    // ITBIS 3 (0% gravado)
        4: 0     // Exento
    },

    CODIGOS_PERMITIDOS_POR_TIPO: {
        '31': [4, 5],
        '32': [4],
        '33': [1, 2, 3, 4],
        '34': [1, 2, 3, 4],
        '41': [4],
        '43': [4],
        '44': [4],
        '45': [4],
        '46': [4],
        '47': [4]
    },

    TIPOS_CON_RETENCION: ['31', '33', '34', '41', '47'],

    // Usados en reglas
    TIPOS_COMPRADOR_OBLIGATORIO_RNC: ['31', '41', '45'],
    TIPOS_COMPRADOR_OBLIGATORIO_NOMBRE: ['31', '41', '44', '45', '46'],
};