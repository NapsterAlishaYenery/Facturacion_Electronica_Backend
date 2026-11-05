// ============================================================
// Tabla II — Codificación de Monedas (DGII v1.0)
// ============================================================

const CURRENCIES = {
    'BRL': { code: 'BRL', name: 'Real Brasilero', country: 'Brasil' },
    'CAD': { code: 'CAD', name: 'Dólar Canadiense', country: 'Canadá' },
    'CHF': { code: 'CHF', name: 'Franco Suizo', country: 'Suiza' },
    'CHY': { code: 'CHY', name: 'Yuan Chino', country: 'China' },
    'XDR': { code: 'XDR', name: 'Derecho Especial de Giro', country: 'FMI' },
    'DKK': { code: 'DKK', name: 'Corona Danesa', country: 'Dinamarca' },
    'EUR': { code: 'EUR', name: 'Euro', country: 'Unión Europea' },
    'GBP': { code: 'GBP', name: 'Libra Esterlina', country: 'Reino Unido' },
    'JPY': { code: 'JPY', name: 'Yen Japonés', country: 'Japón' },
    'NOK': { code: 'NOK', name: 'Corona Noruega', country: 'Noruega' },
    'SCP': { code: 'SCP', name: 'Libra Escocesa', country: 'Escocia' },
    'SEK': { code: 'SEK', name: 'Corona Sueca', country: 'Suecia' },
    'USD': { code: 'USD', name: 'Dólar Estadounidense', country: 'Estados Unidos' },
    'VEF': { code: 'VEF', name: 'Bolívar Fuerte Venezolano', country: 'Venezuela' },
    'MXN': { code: 'MXN', name: 'Peso Mexicano', country: 'México' },
    'HTG': { code: 'HTG', name: 'Gourde Haitiana', country: 'Haití' },
    'COP': { code: 'COP', name: 'Peso Colombiano', country: 'Colombia' }
};

const VALID_CURRENCY_CODES = Object.keys(CURRENCIES);
const DEFAULT_CURRENCY = 'DOP'; // Peso Dominicano (no está en la tabla, es la moneda local)

module.exports = { CURRENCIES, VALID_CURRENCY_CODES, DEFAULT_CURRENCY };