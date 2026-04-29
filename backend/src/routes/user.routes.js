const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const permissionMiddleware = require('../middlewares/permission.middleware');
const { createUserValidator, updateUserValidator } = require('../validators/user.validator');

const router = Router();

router.use(authMiddleware);

router.get('/', permissionMiddleware('users.view'), userController.getAll.bind(userController));
router.post('/', permissionMiddleware('users.create'), createUserValidator, userController.create.bind(userController));
router.get('/:id', permissionMiddleware('users.view'), userController.getById.bind(userController));
router.put('/:id', permissionMiddleware('users.update'), updateUserValidator, userController.update.bind(userController));
router.delete('/:id', permissionMiddleware('users.delete'), userController.delete.bind(userController));

module.exports = router;
