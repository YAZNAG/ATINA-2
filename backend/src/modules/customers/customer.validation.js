const { body, param, validationResult } = require('express-validator');
const response = require('../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const uuidParam = [param('id').isUUID().withMessage('Identifiant client invalide'), validate];

const createValidator = [
  body('phone_country').optional().isLength({ max: 5 }).withMessage('Indicatif invalide'),
  body('phone_number').notEmpty().withMessage('Numéro requis').isLength({ max: 15 }).withMessage('Numéro trop long'),
  body('name').notEmpty().withMessage('Nom requis').isLength({ max: 150 }).withMessage('Nom trop long'),
  body('preferred_lang').optional().isIn(['fr', 'ar']).withMessage('Langue : fr ou ar'),
  body('city').optional({ values: 'null' }).isLength({ max: 100 }).withMessage('Ville trop longue'),
  body('referred_by_id').optional({ values: 'null' }).isUUID().withMessage('Parrain invalide'),
  validate,
];

const latLngValidators = [
  body('lat')
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      const n = Number(v);
      return !Number.isNaN(n) && n >= -90 && n <= 90;
    })
    .withMessage('Latitude invalide'),
  body('lng')
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      const n = Number(v);
      return !Number.isNaN(n) && n >= -180 && n <= 180;
    })
    .withMessage('Longitude invalide'),
];

const updateValidator = [
  body('name').optional().notEmpty().isLength({ max: 150 }),
  body('preferred_lang').optional().isIn(['fr', 'ar']),
  body('city').optional({ values: 'null' }),
  ...latLngValidators,
  body('is_active').optional().isBoolean(),
  validate,
];

module.exports = {
  validate,
  uuidParam,
  createValidator,
  updateValidator,
};
