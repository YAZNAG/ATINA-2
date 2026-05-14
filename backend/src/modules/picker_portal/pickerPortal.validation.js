const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { error } = require('../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return error(res, errors.array()[0]?.msg ?? 'Validation échouée', 400);
  next();
};

const validateAcceptOrder = [
  param('orderId').isUUID().withMessage('orderId invalide'),
  validate,
];

const validatePickItem = [
  param('itemId').isUUID().withMessage('itemId invalide'),
  body('qty_picked')
    .optional()
    .isFloat({ min: 0.001 })
    .withMessage('qty_picked doit être > 0'),
  body('scanned_ean')
    .optional()
    .isString()
    .isLength({ max: 13 })
    .withMessage('scanned_ean invalide (max 13 caractères)'),
  validate,
];

const validateSubstitute = [
  param('itemId').isUUID().withMessage('itemId invalide'),
  body('substitute_sku_id')
    .optional()
    .isUUID()
    .withMessage('substitute_sku_id doit être un UUID valide'),
  body('qty_picked')
    .optional()
    .isFloat({ min: 0.001 })
    .withMessage('qty_picked doit être > 0'),
  validate,
];

module.exports = {
  validateAcceptOrder,
  validatePickItem,
  validateSubstitute,
};
