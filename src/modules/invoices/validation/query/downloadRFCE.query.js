
const Joi = require('joi');
// ============================================================
// Schema: descargar XML del RFCE
// ============================================================
const downloadRFCEQuerySchema = Joi.object({
    type: Joi.string()
        .valid('signed', 'unsigned')
        .optional()
        .default('unsigned')
        .messages({
            'any.only': 'type must be one of: signed, unsigned'
        })
});

module.exports = { downloadRFCEQuerySchema };