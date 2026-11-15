const Joi = require('joi');

const invoiceIdParamsSchema = Joi.object({
    id: Joi.string().uuid({ version: ['uuidv4'] }).required()
        .messages({
            'string.guid': 'Invoice ID must be a valid UUID',
            'any.required': 'Invoice ID is required'
        })
});

module.exports = { invoiceIdParamsSchema };