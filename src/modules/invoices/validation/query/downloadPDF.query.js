
const Joi = require('joi');
// ============================================================
// Schema: descargar PDF
// ============================================================
const downloadPDFQuerySchema = Joi.object({
    format: Joi.string()
        .valid('a4', 'ticket', 'half')
        .optional()
        .default('a4')
        .messages({
            'any.only': 'format must be one of: a4, ticket, half'
        })
});

module.exports = { downloadPDFQuerySchema };