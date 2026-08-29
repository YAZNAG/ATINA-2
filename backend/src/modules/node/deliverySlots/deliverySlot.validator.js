const { body, query, validationResult } = require('express-validator');
const response = require('../../../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return response.error(res, 'Validation échouée', 422, errors.array());
  next();
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createValidator = [
  body('specific_date').isISO8601().withMessage('Date invalide (format YYYY-MM-DD)'),
  body('slot_start').matches(timePattern).withMessage('Heure début invalide'),
  body('slot_end').matches(timePattern).withMessage('Heure fin invalide'),
  body('max_orders').isInt({ min: 0 }).withMessage('Capacité invalide'),
  body('is_active').optional().isBoolean(),
  validate,
];

const updateValidator = [
  body('slot_start').optional().matches(timePattern),
  body('slot_end').optional().matches(timePattern),
  body('max_orders').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
];

const dateQueryValidator = [
  query('date').isISO8601().withMessage('Date invalide (format YYYY-MM-DD)'),
  validate,
];

const monthQueryValidator = [
  query('year').isInt({ min: 2020, max: 2100 }),
  query('month').isInt({ min: 1, max: 12 }),
  validate,
];

module.exports = { createValidator, updateValidator, dateQueryValidator, monthQueryValidator };