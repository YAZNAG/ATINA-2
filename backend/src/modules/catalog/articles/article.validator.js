const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('sku').notEmpty().withMessage('SKU requis'),
  body('name_fr').notEmpty().withMessage('Nom français requis'),
  body('name_ar').notEmpty().withMessage('Nom arabe requis'),
  body('min_stock').optional().isFloat({ min: 0 }).withMessage('Stock min invalide'),
  body('max_stock').optional().isFloat({ min: 0 }).withMessage('Stock max invalide'),
  validate,
];

const updateValidator = [
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('min_stock').optional().isFloat({ min: 0 }),
  body('max_stock').optional().isFloat({ min: 0 }),
  validate,
];

module.exports = { createValidator, updateValidator };
