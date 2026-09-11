const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    const msg = first?.msg && first.msg !== 'Invalid value' ? first.msg : 'Validation échouée';
    return response.error(res, msg, 422, errors.array());
  }
  next();
};

const createValidator = [
  body('code').notEmpty().withMessage('Code requis'),
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  body('description_fr').optional({ values: 'null' }).isString(),
  body('description_ar').optional({ values: 'null' }).isString(),
  body('is_active').optional().isBoolean(),
  validate,
];

const updateValidator = [
  body('code').optional().notEmpty(),
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('description_fr').optional({ values: 'null' }).isString(),
  body('description_ar').optional({ values: 'null' }).isString(),
  body('is_active').optional().isBoolean(),
  validate,
];

module.exports = { createValidator, updateValidator };
