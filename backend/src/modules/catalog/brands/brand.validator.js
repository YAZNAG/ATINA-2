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
  body('description_fr').optional().isString(),
  body('description_ar').optional().isString(),
  body('status').optional().isIn(['active', 'inactive']),
  validate,
];

const updateValidator = [
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('code').optional().notEmpty(),
  body('description_fr').optional().isString(),
  body('description_ar').optional().isString(),
  body('status').optional().isIn(['active', 'inactive']),
  validate,
];

module.exports = { createValidator, updateValidator };
