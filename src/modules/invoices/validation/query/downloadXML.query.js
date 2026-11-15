
const Joi = require('joi');
// ============================================================
// Schema: descargar XML
// ============================================================
const downloadXMLQuerySchema = Joi.object({
    type: Joi.string()
        .valid('signed', 'unsigned')
        .optional()
        .default('unsigned')
        .messages({
            'any.only': 'type must be one of: signed, unsigned'
        })
});

module.exports = { downloadXMLQuerySchema };