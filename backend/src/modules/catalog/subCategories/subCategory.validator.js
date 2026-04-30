const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const isBase64Image = (value) =>
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(value);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('name_fr').notEmpty().withMessage('Nom français requis'),
  body('name_ar').notEmpty().withMessage('Nom arabe requis'),
  body('code').notEmpty().withMessage('Code requis'),
  body('category_id').isInt({ min: 1 }).withMessage('Catégorie requise'),
  body('image_base64')
    .optional({ values: 'falsy' })
    .custom((v) => isBase64Image(v))
    .withMessage('Image base64 invalide'),
  validate,
];

const updateValidator = [
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('category_id').optional().isInt({ min: 1 }),
  body('image_base64')
    .optional({ values: 'falsy' })
    .custom((v) => isBase64Image(v))
    .withMessage('Image base64 invalide'),
  validate,
];

module.exports = { createValidator, updateValidator };
