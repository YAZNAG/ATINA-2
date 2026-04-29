const { body, validationResult } = require('express-validator');
const response = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return response.error(res, 'Validation failed', 422, errors.array());
  }
  next();
};

const createRoleValidator = [
  body('name').notEmpty().withMessage('Role name is required'),
  body('code').notEmpty().withMessage('Role code is required'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  validate,
];

const updateRoleValidator = [
  body('name').optional().notEmpty().withMessage('Role name cannot be empty'),
  body('code').optional().notEmpty().withMessage('Role code cannot be empty'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  validate,
];

module.exports = { createRoleValidator, updateRoleValidator };
