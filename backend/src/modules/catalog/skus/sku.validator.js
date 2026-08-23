const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const hasTaxonomy = (body) =>
  (body.sku_family_id != null && body.sku_family_id !== '') ||
  (body.sku_subfamily_id != null && body.sku_subfamily_id !== '');

const createValidator = [
  body('sku_code').optional({ nullable: true }).trim(),
  body('sku').optional({ nullable: true }).trim(),
  body().custom((_, { req }) => {
    const code = (req.body.sku_code || req.body.sku || '').trim();
    if (!code) throw new Error('Code SKU requis');
    return true;
  }),
  body('name_fr').trim().notEmpty().withMessage('Nom français requis'),
  body('name_ar').trim().notEmpty().withMessage('Nom arabe requis'),
  body().custom((_, { req }) => {
    if (!hasTaxonomy(req.body)) {
      throw new Error('Indiquez une famille SKU ou une sous-famille');
    }
    return true;
  }),
  body('price').exists().withMessage('Prix requis').isFloat({ min: 0 }).withMessage('Prix invalide (≥ 0)'),
  validate,
];

const updateValidator = [
  body('sku_code').optional({ nullable: true }).trim().notEmpty(),
  body('name_fr').optional({ nullable: true }).trim().notEmpty(),
  body('name_ar').optional({ nullable: true }).trim().notEmpty(),
  body('price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Prix invalide (≥ 0)'),
  validate,
];

module.exports = { createValidator, updateValidator };