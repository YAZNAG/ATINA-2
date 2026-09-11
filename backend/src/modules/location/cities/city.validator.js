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
  body('region_id').isUUID().withMessage('La région parente est obligatoire'),
  body('code').notEmpty().withMessage('Code requis'),
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  body('postal_code').optional({ values: 'null' }).isString(),
  body('is_active').optional().isBoolean(),
  body('sort_order').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage("Ordre d'affichage invalide"),
  validate,
];

const updateValidator = [
  body('sort_order').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage("Ordre d'affichage invalide"),
  body('region_id').optional().isUUID().withMessage('Région invalide'),
  body('code').optional().notEmpty(),
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('postal_code').optional({ values: 'null' }).isString(),
  body('is_active').optional().isBoolean(),
  validate,
];

const moveValidator = [
  body('region_id').isUUID().withMessage('Région cible invalide'),
  validate,
];

module.exports = { createValidator, updateValidator, moveValidator };