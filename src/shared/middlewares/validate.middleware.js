// ============================================================
// Middleware de validación con Joi
// Valida el body, query o params de un request
//
// Uso:
//   validate(schema)              → valida req.body
//   validate(schema, 'query')     → valida req.query
//   validate(schema, 'params')    → valida req.params
// ============================================================

function validate(schema, source = 'body') {
    return (req, res, next) => {
        // 1. Validar el source contra el schema
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,      // Devuelve TODOS los errores, no solo el primero
            stripUnknown: true,     // Elimina campos no definidos en el schema
            convert: true           // Convierte tipos (ej: "5" → 5 si el schema dice number)
        });

        // 2. Si hay errores, devolverlos
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input data',
                    details: errors
                }
            });
        }

        // 3. Reemplazar el source con los datos validados y saneados
        //    Joi hace casting (ej: convierte strings numéricos a number)
        if (source === 'body') {
            // body: asignación directa (funciona bien)
            req.body = value;
        } else {
            // query / params: NO reasignamos (Express 5 los bloquea)
            // Guardamos el valor validado en req.validated[source]
            if (!req.validated) req.validated = {};
            req.validated[source] = value;
        }

        // 4. Continuar
        next();
    };
}

module.exports = validate;