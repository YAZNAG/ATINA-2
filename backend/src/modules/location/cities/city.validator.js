const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('region_id').isUUID().withMessage('Région invalide'),
  body('code').notEmpty().withMessage('Code requis'),
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  body('postal_code').optional().isString(),
  body('is_active').optional().isBoolean(),
  validate,
];

const updateValidator = [
  body('region_id').optional().isUUID(),
  body('code').optional().notEmpty(),
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('postal_code').optional().isString(),
  body('is_active').optional().isBoolean(),
  validate,
];

module.exports = { createValidator, updateValidator };