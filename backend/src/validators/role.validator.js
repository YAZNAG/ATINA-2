const { body, validationResult } = require('express-validator');
const response = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return response.error(res, first?.msg || 'Validation échouée', 422, errors.array());
  }
  next();
};

const createRoleValidator = [
  body().custom((_, { req }) => {
    const n = String(req.body?.name_fr ?? req.body?.name ?? '').trim();
    if (!n) throw new Error('Nom (FR) du rôle requis');
    return true;
  }),
  body('code').trim().notEmpty().withMessage('Code du rôle requis'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Statut invalide (active ou inactive)'),
  validate,
];

const updateRoleValidator = [
  body('name').optional().trim().notEmpty().withMessage('Le nom du rôle ne peut pas être vide'),
  body('name_fr').optional().trim().notEmpty().withMessage('Le nom (FR) du rôle ne peut pas être vide'),
  body('code').optional().trim().notEmpty().withMessage('Le code du rôle ne peut pas être vide'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Statut invalide (active ou inactive)'),
  validate,
];

module.exports = { createRoleValidator, updateRoleValidator };
