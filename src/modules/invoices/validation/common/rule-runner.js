// Ejecuta reglas puras en orden. Corta en la primera que devuelva algo.
function runRules(rules, value, helpers) {
    for (const rule of rules) {
        const result = rule(value, helpers);
        if (result !== undefined) return result;
    }
    return value;
}

module.exports = { runRules };