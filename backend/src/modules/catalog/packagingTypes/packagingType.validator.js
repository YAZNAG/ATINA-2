const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('name_fr').notEmpty().withMessage('Nom français requis'),
  body('name_ar').notEmpty().withMessage('Nom arabe requis'),
  body('code').notEmpty().withMessage('Code requis'),
  body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantité invalide'),
  validate,
];

const updateValidator = [
  body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantité invalide'),
  validate,
];

module.exports = { createValidator, updateValidator };
