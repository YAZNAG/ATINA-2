const { body, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const createValidator = [
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  body('day_of_week').isInt({ min: 0, max: 6 }).withMessage('Jour invalide'),
  body('slot_start').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Heure début invalide'),
  body('slot_end').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Heure fin invalide'),
  body('max_orders').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
];

const updateValidator = [
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('day_of_week').optional().isInt({ min: 0, max: 6 }),
  body('slot_start').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('slot_end').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('max_orders').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
];

module.exports = { createValidator, updateValidator };
