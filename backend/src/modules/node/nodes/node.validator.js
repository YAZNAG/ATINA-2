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
  body('node_type_id').isUUID().withMessage('Type node invalide'),
  body('region_id').isUUID().withMessage('Région invalide'),
  body('city_id').isUUID().withMessage('Ville invalide'),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  body('delivery_radius_km').optional().isFloat({ min: 0 }),
  body('max_daily_orders').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
];

const updateValidator = [
  body('code').optional().notEmpty(),
  body('name_fr').optional().notEmpty(),
  body('name_ar').optional().notEmpty(),
  body('node_type_id').optional().isUUID(),
  body('region_id').optional().isUUID(),
  body('city_id').optional().isUUID(),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  body('delivery_radius_km').optional().isFloat({ min: 0 }),
  body('max_daily_orders').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
  validate,
];

module.exports = { createValidator, updateValidator };