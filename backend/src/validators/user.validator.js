const { body, validationResult } = require('express-validator');
const response = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return response.error(res, 'Validation failed', 422, errors.array());
  }
  next();
};

const createUserValidator = [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  validate,
];

const updateUserValidator = [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  validate,
];

module.exports = { createUserValidator, updateUserValidator };
