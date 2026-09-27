// ============================================================
// Generador de XML para e-CF (Comprobantes Fiscales Electrónicos)
// Este módulo es invocado por invoices.service.js
// NO es un módulo HTTP. NO tiene rutas ni controladores.
// ============================================================

// ============================================================
// 1. UTILIDADES DE ESCAPADO Y LIMPIEZA XML
// ============================================================

// ------------------------------------------------------------
// Escapa caracteres especiales en texto para que sea seguro en XML
// Requisito: el texto del usuario puede contener &, <, >, ", '
// Si no se escapan, el XML queda inválido.
// ------------------------------------------------------------
function escapeXMLSpecialChars(text) {
    if (text === null || text === undefined) {
        return '';
    }

    const str = String(text);

    return str
        .replace(/&/g, '&amp;')   // PRIMERO, porque las demás entidades usan &
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ------------------------------------------------------------
// Elimina tags vacíos del XML
// Requisito DGII: el XML NO puede contener tags vacíos
//   <tag></tag>  → se elimina
//   <tag/>       → se elimina
//   <tag>   </tag> → se elimina (solo espacios en blanco)
// ------------------------------------------------------------
function removeEmptyTags(xml) {
    if (!xml || typeof xml !== 'string') {
        return xml;
    }

    // Iterar hasta que no haya cambios (porque eliminar un tag puede
    // dejar el padre vacío y hay que eliminarlo también)
    let previousXml;
    let currentXml = xml;

    do {
        previousXml = currentXml;

        // Elimina <tag></tag> y <tag>   </tag> (con espacios)
        currentXml = currentXml.replace(
            /<([a-zA-Z0-9_:]+)(\s[^>]*)?>\s*<\/\1>/g,
            ''
        );

        // Elimina <tag/> (self-closing)
        currentXml = currentXml.replace(
            /<([a-zA-Z0-9_:]+)(\s[^>]*)?\/>/g,
            ''
        );

    } while (currentXml !== previousXml);

    return currentXml;
}

module.exports = {
    escapeXMLSpecialChars,
    removeEmptyTags
};