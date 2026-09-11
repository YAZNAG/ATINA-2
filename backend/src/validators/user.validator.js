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

const roleIdsRule = (field) => body(field).optional({ values: 'null' }).custom((v) => {
  const arr = Array.isArray(v) ? v : [v];
  if (arr.some((x) => !Number.isInteger(Number(x)) || Number(x) <= 0)) throw new Error('Rôle invalide');
  return true;
});

const createUserValidator = [
  body('full_name').trim().notEmpty().withMessage('Nom complet requis'),
  body('email').trim().isEmail().withMessage('Email valide requis'),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Statut invalide (active ou inactive)'),
  roleIdsRule('role_ids'),
  roleIdsRule('role_id'),
  validate,
];

const updateUserValidator = [
  body('full_name').optional().trim().notEmpty().withMessage('Le nom complet ne peut pas être vide'),
  body('email').optional().trim().isEmail().withMessage('Email valide requis'),
  body('password').optional({ values: 'falsy' }).isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Statut invalide (active ou inactive)'),
  roleIdsRule('role_ids'),
  roleIdsRule('role_id'),
  validate,
];

const assignRoleValidator = [
  body().custom((_, { req }) => {
    if (req.body?.role_id === undefined && req.body?.role_ids === undefined) throw new Error('Rôle requis');
    return true;
  }),
  roleIdsRule('role_ids'),
  roleIdsRule('role_id'),
  validate,
];

module.exports = { createUserValidator, updateUserValidator, assignRoleValidator };
