const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('code').notEmpty().withMessage('Code requis'),
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  validate,
];

const updateValidator = [
  body('code').optional().notEmpty().withMessage('Code invalide'),
  body('name_fr').optional().notEmpty().withMessage('Nom FR invalide'),
  body('name_ar').optional().notEmpty().withMessage('Nom AR invalide'),
  validate,
];

module.exports = { createValidator, updateValidator };
