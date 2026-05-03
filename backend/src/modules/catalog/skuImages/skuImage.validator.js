const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('sku_id').isUUID().withMessage('sku_id UUID requis'),
  body('url').notEmpty().withMessage('URL requise'),
  body('alt_fr').optional().isString(),
  body('alt_ar').optional().isString(),
  body('is_primary').optional().isBoolean(),
  body('sort_order').optional().isInt(),
  validate,
];

const updateValidator = [
  body('sku_id').optional().isUUID(),
  body('url').optional().notEmpty(),
  body('alt_fr').optional().isString(),
  body('alt_ar').optional().isString(),
  body('is_primary').optional().isBoolean(),
  body('sort_order').optional().isInt(),
  validate,
];

module.exports = { createValidator, updateValidator, validate };
