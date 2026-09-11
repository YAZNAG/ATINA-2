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

const optFloat = (field, msg, opts = {}) =>
  body(field).optional({ values: 'falsy' }).isFloat(opts).withMessage(msg);

const common = [
  optFloat('lat', 'Latitude invalide (entre -90 et 90)', { min: -90, max: 90 }),
  optFloat('lng', 'Longitude invalide (entre -180 et 180)', { min: -180, max: 180 }),
  optFloat('delivery_radius_km', 'Le rayon de livraison doit être positif ou nul', { min: 0 }),
  body('max_daily_orders').optional({ values: 'falsy' }).isInt({ min: 0 })
    .withMessage('La capacité max / jour doit être un entier positif ou nul'),
  body('delivery_fee').optional({ values: 'null' }).isFloat({ min: 0 })
    .withMessage('Les frais de livraison doivent être supérieurs ou égaux à 0 MAD'),
  body('min_order_amount').optional({ values: 'null' }).isFloat({ min: 0 })
    .withMessage('Le montant minimum de commande doit être supérieur ou égal à 0 MAD'),
  body('is_active').optional().isBoolean().withMessage('Statut invalide'),
  body('slot_selection_enabled').optional().isBoolean().withMessage('Valeur invalide pour la sélection de créneau'),
];

const createValidator = [
  body('code').notEmpty().withMessage('Code requis'),
  body('name_fr').notEmpty().withMessage('Nom FR requis'),
  body('name_ar').notEmpty().withMessage('Nom AR requis'),
  body('node_type_id').isUUID().withMessage('Type de node invalide'),
  body('region_id').optional({ values: 'falsy' }).isUUID().withMessage('Région invalide'),
  body('city_id').isUUID().withMessage('Ville invalide'),
  ...common,
  validate,
];

const updateValidator = [
  body('code').optional().notEmpty().withMessage('Code requis'),
  body('name_fr').optional().notEmpty().withMessage('Nom FR requis'),
  body('name_ar').optional().notEmpty().withMessage('Nom AR requis'),
  body('node_type_id').optional({ values: 'falsy' }).isUUID().withMessage('Type de node invalide'),
  body('region_id').optional({ values: 'falsy' }).isUUID().withMessage('Région invalide'),
  body('city_id').optional({ values: 'falsy' }).isUUID().withMessage('Ville invalide'),
  ...common,
  validate,
];

module.exports = { createValidator, updateValidator };
